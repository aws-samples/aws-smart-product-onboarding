/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { act, renderHook } from "@testing-library/react";
import { useProductFlow } from "./useProductFlow";

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
});
