/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./App";

vi.mock("./auth/AuthProvider", () => ({
  useAuth: () => ({ username: "maria", signOut: vi.fn() }),
}));
// A page whose code could not be loaded, for example after a redeploy removed the old files.
vi.mock("./features/batches/BatchesPage", () => {
  throw new Error("Failed to fetch dynamically imported module");
});
vi.mock("./features/quick/QuickGeneratePage", () => ({
  QuickGeneratePage: () => <p>Quick generate page</p>,
}));

describe("lazy pages", () => {
  it("shows the other page when one of them failed", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <MemoryRouter initialEntries={["/batches"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("This page could not be loaded."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: /Quick generate/ }));
    expect(await screen.findByText("Quick generate page")).toBeInTheDocument();
    expect(
      screen.queryByText("This page could not be loaded."),
    ).not.toBeInTheDocument();
    log.mockRestore();
  });
});
