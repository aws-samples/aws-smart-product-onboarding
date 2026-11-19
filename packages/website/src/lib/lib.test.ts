/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { countByGroup, filterBatches, perDay } from "./batches";
import { openCamera } from "./camera";
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
import { dataUrlToFile, makePreview } from "./images";
import {
  dayRange,
  formatDateTime,
  formatDuration,
  parseLocalDate,
  relativeTime,
} from "./time";
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

  const problem = (csv: string, zip = true) =>
    validateCatalog(summarizeCsv(csv), zip);

  it("rejects rows the batch could not process", () => {
    const header = "title,description,images\n";
    expect(problem(`${header}A,B,\nC,D,\n`)).toBeUndefined();
    expect(problem(`${header}A,,\n`)).toMatch(/Row 2 needs a title/);
    expect(problem(`${header}A,B,\n,,\n,D,\n`)).toMatch(/Row 4 needs/);
    expect(problem(`${header},,front.jpg\n`)).toMatch(/Row 2.*list/);
    expect(problem(`${header},,"['front.jpg']"\n`)).toBeUndefined();
    // An unquoted comma in the description shifts the fields.
    expect(problem("title,description\nA,Warm, soft\n", false)).toMatch(
      /Row 2 has more fields/,
    );
    expect(problem('title,description\nA,"B\n', false)).toMatch(/never closed/);
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

  it("does not bring back drafts that another tab cleared", () => {
    saveDraft(draft("a", 1));
    saveDraft(draft("b", 2));
    expect(listDrafts()).toHaveLength(2);
    // Another tab cleared the list; this tab has not been told yet.
    localStorage.setItem(`${DRAFTS_KEY}:maria`, "[]");
    saveDraft(draft("c", 3));
    expect(listDrafts().map((d) => d.id)).toEqual(["c"]);
  });

  it("keeps drafts by account ID, so a reused user name starts empty", () => {
    setDraftsOwner("sub-1", "maria");
    saveDraft(draft("old", 1));
    expect(localStorage.getItem(`${DRAFTS_KEY}:sub-1`)).toContain("old");
    // The account was deleted and created again under the same user name.
    setDraftsOwner("");
    setDraftsOwner("sub-2", "maria");
    expect(listDrafts()).toEqual([]);
  });

  it("moves drafts saved under the user name once, to an account that has none", () => {
    localStorage.setItem(`${DRAFTS_KEY}:li`, JSON.stringify([draft("old", 1)]));
    setDraftsOwner("sub-li", "li");
    expect(listDrafts().map((d) => d.id)).toEqual(["old"]);
    expect(localStorage.getItem(`${DRAFTS_KEY}:li`)).toBeNull();
    // An account that already has drafts keeps them and leaves the old ones alone.
    localStorage.setItem(`${DRAFTS_KEY}:jo`, JSON.stringify([draft("old", 1)]));
    localStorage.setItem(`${DRAFTS_KEY}:sub-jo`, JSON.stringify([]));
    setDraftsOwner("sub-jo", "jo");
    expect(listDrafts()).toEqual([]);
    expect(localStorage.getItem(`${DRAFTS_KEY}:jo`)).not.toBeNull();
  });

  it("drops photos that could not be restored when storage is full", () => {
    const real = Storage.prototype.setItem;
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, k, v) {
        if (v.includes("base64"))
          throw new DOMException("full", "QuotaExceededError");
        real.call(this, k, v);
      });
    const d = draft("big", 1);
    d.images.push({
      id: "new",
      name: "b.jpg",
      type: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,BBBB",
    });
    saveDraft(d);
    expect(listDrafts()[0].images.map((i) => i.id)).toEqual(["i"]);
    spy.mockRestore();
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

describe("time of day", () => {
  it("writes midnight as 00:xx, never 24:xx", () => {
    const midnight = new Date(2026, 10, 18, 0, 5);
    const spy = vi.spyOn(Date.prototype, "toLocaleTimeString");
    expect(formatDateTime(midnight.toISOString(), midnight)).toBe("00:05");
    // Some browsers read hour12: false as a 1-24 clock.
    expect(spy.mock.calls[0][1]).toMatchObject({ hourCycle: "h23" });
    expect(spy.mock.calls[0][1]).not.toHaveProperty("hour12");
    spy.mockRestore();
  });
});

describe("saved previews", () => {
  it("rebuilds an image from a data URL and refuses damaged ones", () => {
    expect(dataUrlToFile("data:image/jpeg;base64,AAAA", "a.png")?.name).toBe(
      "a.jpg",
    );
    expect(dataUrlToFile("data:,", "a.jpg")).toBeUndefined();
    expect(
      dataUrlToFile("data:image/jpeg;base64,@@@", "a.jpg"),
    ).toBeUndefined();
  });
});

describe("previews of extreme images", () => {
  it("keeps at least one pixel on the short side", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 10_000,
      height: 1,
      close: () => undefined,
    }));
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillRect: () => undefined,
        drawImage: () => undefined,
      }),
      toDataURL: () => "data:image/jpeg;base64,AAAA",
    };
    const create = vi
      .spyOn(document, "createElement")
      .mockReturnValue(canvas as unknown as HTMLElement);
    await makePreview(new Blob(["x"]));
    create.mockRestore();
    vi.unstubAllGlobals();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(1);
  });
});

describe("camera", () => {
  const stream = {} as MediaStream;
  const overconstrained = () =>
    Object.assign(new Error("no"), { name: "OverconstrainedError" });

  it("drops the preferences a camera can't meet", async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(overconstrained())
      .mockResolvedValue(stream);
    await expect(openCamera(get, "", true)).resolves.toBe(stream);
    expect(get.mock.calls[0][0].video).toMatchObject({
      facingMode: "environment",
    });
    expect(get.mock.calls[1][0]).toEqual({ video: true });
  });

  it("keeps a chosen camera while only the size can't be met", async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(overconstrained())
      .mockResolvedValue(stream);
    await openCamera(get, "cam-2", false);
    expect(get.mock.calls[1][0]).toEqual({
      video: { deviceId: { exact: "cam-2" } },
    });
  });

  it("stops at once when access is refused", async () => {
    const denied = Object.assign(new Error("no"), { name: "NotAllowedError" });
    const get = vi.fn().mockRejectedValue(denied);
    await expect(openCamera(get, "", false)).rejects.toBe(denied);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
