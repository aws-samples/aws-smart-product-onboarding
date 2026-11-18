/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { countByGroup, filterBatches, perDay } from "./batches";
import { parseCsv, SAMPLE_CSV, summarizeCsv, validateCatalog } from "./csv";
import {
  clearDrafts,
  DRAFTS_KEY,
  listDrafts,
  MAX_DRAFTS,
  resetDraftCache,
  saveDraft,
  setDraftsOwner,
  type Draft,
} from "./drafts";
import { dayRange, formatDuration, parseLocalDate, relativeTime } from "./time";
import type { BatchExecution } from "../api/client";
import { parseRuntimeConfig } from "../config/runtime";

describe("CSV catalog checks", () => {
  it("parses quoted fields with commas, quotes and line breaks", () => {
    expect(parseCsv('a,b\n"x, y","he said ""hi""\nline 2"\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"\nline 2'],
    ]);
  });

  it("summarizes columns and product rows", () => {
    expect(summarizeCsv("\uFEFFTitle, Description\nA,B\n\nC,D\n")).toEqual({
      columns: ["title", "description"],
      rows: 2,
    });
    expect(summarizeCsv(SAMPLE_CSV).rows).toBe(2);
  });

  it("requires title and description, or images with a ZIP", () => {
    expect(
      validateCatalog({ columns: ["title", "description"], rows: 1 }, false),
    ).toBeUndefined();
    expect(validateCatalog({ columns: ["title"], rows: 1 }, false)).toMatch(
      /'title' and 'description'/,
    );
    expect(validateCatalog({ columns: ["images"], rows: 1 }, false)).toMatch(
      /ZIP/,
    );
    expect(
      validateCatalog({ columns: ["images"], rows: 1 }, true),
    ).toBeUndefined();
    expect(
      validateCatalog({ columns: ["title", "description"], rows: 0 }, false),
    ).toMatch(/no products/);
    expect(validateCatalog({ columns: [], rows: 0 }, false)).toMatch(/empty/);
  });
});

describe("runtime config", () => {
  const good = {
    region: "us-west-2",
    userPoolId: "p",
    userPoolWebClientId: "c",
    identityPoolId: "i",
    typeSafeApis: { "smart-product-onboarding-api": "https://x/prod/" },
  };
  it("accepts the keys the stack writes", () => {
    expect(parseRuntimeConfig(good)).toEqual(good);
  });
  it("rejects a config without the API URL or Cognito IDs", () => {
    expect(parseRuntimeConfig({ ...good, typeSafeApis: {} })).toMatch(
      /typeSafeApis/,
    );
    expect(parseRuntimeConfig({ ...good, userPoolId: "" })).toMatch(
      /userPoolId/,
    );
    expect(parseRuntimeConfig(null)).toMatch(/not a JSON object/);
  });
});

const draft = (
  id: string,
  updatedAt: number,
  dataUrl = "data:image/jpeg;base64,AAAA",
): Draft => ({
  id,
  updatedAt,
  step: 3,
  images: [
    {
      id: "i",
      name: "a.jpg",
      type: "image/jpeg",
      dataUrl,
      key: "uploads/a.jpg",
    },
  ],
  metadata: "",
  options: {
    language: "",
    descriptionLength: "long",
    model: "m",
    temperature: 0.1,
  },
  examples: [],
  product: { title: `Product ${id}`, description: "d" },
});

describe("recent drafts", () => {
  beforeEach(() => {
    localStorage.clear();
    setDraftsOwner("maria");
    resetDraftCache();
  });

  it("keeps each user's drafts separate", () => {
    saveDraft(draft("mine", 1));
    setDraftsOwner("li");
    expect(listDrafts()).toEqual([]);
    saveDraft(draft("theirs", 2));
    setDraftsOwner("maria");
    expect(listDrafts().map((d) => d.id)).toEqual(["mine"]);
    setDraftsOwner("");
    expect(listDrafts()).toEqual([]);
    expect(saveDraft(draft("nobody", 3))).toBe(false);
  });

  it("reports a failed save when nothing fits", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    expect(saveDraft(draft("x", 1))).toBe(false);
    spy.mockRestore();
    resetDraftCache();
    expect(listDrafts()).toEqual([]);
  });

  it("keeps the newest drafts first and caps the list", () => {
    for (let n = 0; n < MAX_DRAFTS + 2; n++) saveDraft(draft(`d${n}`, n));
    const ids = listDrafts().map((d) => d.id);
    expect(ids).toHaveLength(MAX_DRAFTS);
    expect(ids[0]).toBe(`d${MAX_DRAFTS + 1}`);
    resetDraftCache();
    expect(listDrafts().map((d) => d.id)).toEqual(ids);
  });

  it("updates an existing draft in place and clears all", () => {
    saveDraft(draft("a", 1));
    saveDraft({
      ...draft("a", 2),
      product: { title: "Renamed", description: "d" },
    });
    expect(listDrafts()).toHaveLength(1);
    expect(listDrafts()[0].product?.title).toBe("Renamed");
    clearDrafts();
    expect(listDrafts()).toEqual([]);
    expect(localStorage.getItem(`${DRAFTS_KEY}:maria`)).toBe("[]");
  });

  it("drops images when storage is full instead of losing the draft", () => {
    const real = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, k, v) {
        if (v.includes("base64"))
          throw new DOMException("full", "QuotaExceededError");
        real.call(this, k, v);
      });
    saveDraft(draft("big", 1));
    expect(listDrafts()[0].images[0].dataUrl).toBe("");
    expect(listDrafts()[0].images[0].key).toBe("uploads/a.jpg");
    spy.mockRestore();
  });
});

describe("time helpers", () => {
  it("formats relative times", () => {
    const now = 1_000_000_000_000;
    expect(relativeTime(now - 10_000, now)).toBe("just now");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5 min. ago");
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("2 hr. ago");
    expect(relativeTime(now - 26 * 3_600_000, now)).toBe("yesterday");
  });

  it("builds whole-day ranges and durations", () => {
    const { start, end } = dayRange(
      new Date(2026, 10, 1, 15),
      new Date(2026, 10, 18, 9),
    );
    expect(start).toMatch(/^2026-11-01T00:00:00[+-]\d\d:\d\d$/);
    expect(end).toMatch(/^2026-11-18T23:59:59[+-]\d\d:\d\d$/);
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(124_000)).toBe("2m 04s");
    expect(formatDuration(-1)).toBe("—");
    expect(parseLocalDate("2026-11-18")?.getDate()).toBe(18);
    expect(parseLocalDate("")).toBeUndefined();
    expect(parseLocalDate("2026-11")).toBeUndefined();
  });
});

describe("batch list", () => {
  const b = (
    id: string,
    status: BatchExecution["status"],
    updatedAt: string,
  ): BatchExecution => ({
    executionId: id,
    status,
    createdAt: updatedAt,
    updatedAt,
  });
  const items = [
    b("aaa-1", "SUCCESS", "2026-11-17T10:00:00Z"),
    b("bbb-2", "RUNNING", "2026-11-18T10:00:00Z"),
    b("ccc-3", "ERROR", "2026-11-16T10:00:00Z"),
    b("ddd-4", "QUEUED", "2026-11-18T09:00:00Z"),
  ];

  it("groups queued, waiting and started batches as running", () => {
    expect(countByGroup(items)).toEqual({ all: 4, active: 2, ok: 1, err: 1 });
  });

  it("filters by status and ID, newest update first", () => {
    expect(filterBatches(items, "all", "").map((x) => x.executionId)).toEqual([
      "bbb-2",
      "ddd-4",
      "aaa-1",
      "ccc-3",
    ]);
    expect(
      filterBatches(items, "active", "").map((x) => x.executionId),
    ).toEqual(["bbb-2", "ddd-4"]);
    expect(
      filterBatches(items, "all", "CCC").map((x) => x.executionId),
    ).toEqual(["ccc-3"]);
  });

  it("counts batches per day", () => {
    const days = perDay(items, 3, new Date("2026-11-18T12:00:00"));
    expect(days.map((d) => d.count).reduce((a, c) => a + c, 0)).toBe(4);
    expect(days).toHaveLength(3);
  });
});
