/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./AppShell";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ username: "maria", signOut: vi.fn() }),
}));

const Probe = () => {
  const location = useLocation();
  return <p data-testid="state">{JSON.stringify(location.state)}</p>;
};

describe("AppShell", () => {
  it("opens an empty product from the New product link, even on /new", async () => {
    render(
      <MemoryRouter initialEntries={["/batches"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/new" element={<Probe />} />
            <Route path="/batches" element={<Probe />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: /New product/ });
    await userEvent.click(link);
    const first = JSON.parse(screen.getByTestId("state").textContent!);
    expect(first.fresh).toEqual(expect.any(Number));

    await new Promise((r) => setTimeout(r, 5));
    await userEvent.click(screen.getByRole("link", { name: /New product/ }));
    const second = JSON.parse(screen.getByTestId("state").textContent!);
    expect(second.fresh).toBeGreaterThan(first.fresh);
  });
});
