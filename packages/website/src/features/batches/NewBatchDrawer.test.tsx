/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewBatchDrawer } from "./NewBatchDrawer";

vi.mock("../../api/client", async (original) => ({
  ...(await original<typeof import("../../api/client")>()),
  useApi: () => ({
    fetchClient: {},
    $api: { useMutation: () => ({ mutateAsync: vi.fn() }) },
  }),
}));

describe("NewBatchDrawer", () => {
  it("clears the file's error when the file is removed", async () => {
    render(
      <NewBatchDrawer isOpen onOpenChange={vi.fn()} onStarted={vi.fn()} />,
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]')!;
    // jsdom's File has no text() method.
    const file = Object.assign(
      new File(["title\nMug\n"], "catalog.csv", { type: "text/csv" }),
      { text: async () => "title\nMug\n" },
    );
    await userEvent.upload(input, file);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /needs 'title' and 'description'/,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove catalog.csv" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
