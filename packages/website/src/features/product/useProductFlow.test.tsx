/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { act, renderHook } from "@testing-library/react";
import { useProductFlow } from "./useProductFlow";
import {
  DRAFTS_KEY,
  resetDraftCache,
  saveDraft,
  setDraftsOwner,
  type Draft,
} from "../../lib/drafts";

const api = vi.hoisted(() => ({
  "/generateProduct": vi.fn(),
  "/metaclass": vi.fn(),
  "/categorizeProduct": vi.fn(),
  "/extractAttributes": vi.fn(),
}));
vi.mock("../../api/client", async (original) => ({
  ...(await original<typeof import("../../api/client")>()),
  useApi: () => ({
    fetchClient: {},
    $api: {
      useMutation: (_method: string, path: keyof typeof api) => ({
        mutateAsync: api[path],
      }),
    },
  }),
}));

const listing = (title: string, description = "A sturdy mug.") => ({
  product: { title, description },
  usage: { inputTokens: 1 },
});

const setup = async () => {
  const { result } = renderHook(() => useProductFlow({ persist: false }));
  act(() => result.current.setMetadata("Brand: Acme"));
  await act(() => result.current.generate());
  return result;
};

describe("useProductFlow", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api["/generateProduct"].mockResolvedValue(listing("Mug"));
    api["/metaclass"].mockResolvedValue({ possibleCategories: ["c1"] });
    api["/categorizeProduct"].mockResolvedValue({
      categoryId: "c1",
      categoryName: "Mugs",
    });
    api["/extractAttributes"].mockImplementation(
      async ({ body }: { body: { product: { title: string } } }) => ({
        attributes: [{ name: "Title", value: body.product.title }],
      }),
    );
  });

  it("does not categorize a listing without a title or description", async () => {
    api["/generateProduct"].mockResolvedValue(listing("Mug", "  "));
    const flow = await setup();
    expect(flow.current.canClassify).toBe(false);
    await act(() => flow.current.classify());
    expect(api["/metaclass"]).not.toHaveBeenCalled();

    act(() => flow.current.updateProduct({ description: "A sturdy mug." }));
    expect(flow.current.canClassify).toBe(true);
    act(() => flow.current.updateProduct({ title: " " }));
    expect(flow.current.canClassify).toBe(false);
  });

  it("marks the listing out of date when the metadata or images change", async () => {
    const flow = await setup();
    expect(flow.current.generationStale).toBe(false);
    act(() => flow.current.setMetadata("Brand: Other"));
    expect(flow.current.generationStale).toBe(true);
    act(() => flow.current.setMetadata("Brand: Acme"));
    expect(flow.current.generationStale).toBe(false);
    act(() => {
      flow.current.addImages([new File(["x"], "a.png", { type: "image/png" })]);
    });
    expect(flow.current.generationStale).toBe(true);
  });

  it("keeps attributes out of date after undoing an attributes-only run", async () => {
    const flow = await setup();
    await act(() => flow.current.classify());
    expect(flow.current.classified).toBe(true);

    // Edit the title: the category is out of date, so attributes-only is refused.
    act(() => flow.current.updateProduct({ title: "Big mug" }));
    expect(flow.current.categoryStale).toBe(true);
    await act(() => flow.current.extract());
    expect(api["/extractAttributes"]).toHaveBeenCalledTimes(1);

    // Undo: everything matches the categorized listing again.
    act(() => flow.current.updateProduct({ title: "Mug" }));
    expect(flow.current.classificationStale).toBe(false);

    // An attributes-only run, then an edit and its undo, leaves nothing stale.
    await act(() => flow.current.extract());
    expect(api["/extractAttributes"]).toHaveBeenCalledTimes(2);
    expect(flow.current.attributes?.[0].value).toBe("Mug");
    act(() => flow.current.updateProduct({ title: "Big mug" }));
    expect(flow.current.classificationStale).toBe(true);
    act(() => flow.current.updateProduct({ title: "Mug" }));
    expect(flow.current.classificationStale).toBe(false);
  });

  it("records the language and length a listing was generated with", async () => {
    const { result } = renderHook(() => useProductFlow({ persist: false }));
    act(() => {
      result.current.setMetadata("Brand: Acme");
      result.current.setOptions({
        ...result.current.options,
        language: "French",
        descriptionLength: "short",
      });
    });
    await act(() => result.current.generate());
    act(() =>
      result.current.setOptions({
        ...result.current.options,
        language: "German",
        descriptionLength: "long",
      }),
    );
    expect(result.current.generatedWith).toEqual({
      language: "French",
      descriptionLength: "short",
    });
  });

  describe("saved drafts", () => {
    const saved = (patch: Partial<Draft> = {}): Draft => ({
      id: "d1",
      updatedAt: 1000,
      step: 3,
      images: [],
      metadata: "Brand: Acme",
      options: {
        language: "",
        descriptionLength: "long",
        model: "",
        temperature: 0.1,
      },
      examples: [],
      product: { title: "Mug", description: "A sturdy mug." },
      ...patch,
    });
    const stored = () =>
      JSON.parse(
        localStorage.getItem(`${DRAFTS_KEY}:sub-1`) ?? "[]",
      ) as Draft[];
    const open = (draftId?: string) =>
      renderHook(() => useProductFlow({ draftId, persist: true }));

    beforeEach(() => {
      vi.useFakeTimers();
      localStorage.clear();
      setDraftsOwner("sub-1");
      resetDraftCache();
      window.history.replaceState(null, "", "/");
    });
    afterEach(() => vi.useRealTimers());

    it("keeps the saved time and the saved text of a draft that was only opened", async () => {
      saveDraft(saved());
      const { unmount } = open("d1");
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(stored()[0].updatedAt).toBe(1000);
      unmount();
      expect(stored()[0].updatedAt).toBe(1000);
    });

    it("saves an edit to an opened draft", async () => {
      saveDraft(saved());
      const { result } = open("d1");
      act(() => result.current.updateProduct({ title: "Big mug" }));
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(stored()[0].product?.title).toBe("Big mug");
      expect(stored()[0].updatedAt).toBeGreaterThan(1000);
    });

    it("does not save a draft again after another tab cleared the list", async () => {
      saveDraft(saved());
      const { result } = open("d1");
      localStorage.setItem(`${DRAFTS_KEY}:sub-1`, "[]");
      act(() => result.current.updateProduct({ title: "Big mug" }));
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(stored()).toEqual([]);
    });

    it("opens a draft whose saved preview is empty or damaged", () => {
      const image = { id: "i", name: "wide.png", type: "image/png" };
      saveDraft(
        saved({
          images: [
            { ...image, dataUrl: "data:," },
            { ...image, id: "j", dataUrl: "data:image/jpeg;base64,@@@" },
          ],
        }),
      );
      const { result } = open("d1");
      expect(result.current.images.map((i) => [i.url, i.file])).toEqual([
        ["", undefined],
        ["", undefined],
      ]);
    });

    it("moves the address to the new draft when the opened one no longer exists", async () => {
      window.history.replaceState(null, "", "/drafts/gone");
      const { result } = open("gone");
      act(() => result.current.setMetadata("Brand: Acme"));
      await act(() => result.current.generate());
      await act(() => vi.advanceTimersByTimeAsync(400));
      expect(window.location.pathname).toBe(`/drafts/${result.current.id}`);
      expect(stored()[0].id).toBe(result.current.id);
    });
  });
});
