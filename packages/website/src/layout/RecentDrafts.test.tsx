/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { RecentDrafts } from "./RecentDrafts";
import {
  resetDraftCache,
  saveDraft,
  setActiveDraftId,
  setDraftsOwner,
  type Draft,
} from "../lib/drafts";

const draft = (id: string): Draft => ({
  id,
  updatedAt: Date.now(),
  step: 3,
  images: [],
  metadata: "",
  options: {
    language: "",
    descriptionLength: "long",
    model: "",
    temperature: 0.1,
  },
  examples: [],
  product: { title: `Product ${id}`, description: "d" },
});

const Where = () => <p data-testid="path">{useLocation().pathname}</p>;

describe("RecentDrafts", () => {
  beforeEach(() => {
    localStorage.clear();
    setDraftsOwner("sub-1");
    resetDraftCache();
    saveDraft(draft("open"));
    saveDraft(draft("other"));
    setActiveDraftId("open");
  });
  afterEach(() => setActiveDraftId(undefined));

  const show = () =>
    render(
      <MemoryRouter initialEntries={["/new"]}>
        <RecentDrafts />
        <Where />
      </MemoryRouter>,
    );

  it("stays on the editor when the open draft is clicked", async () => {
    show();
    await userEvent.click(screen.getByRole("link", { name: /Product open/ }));
    expect(screen.getByTestId("path")).toHaveTextContent("/new");
  });

  it("leaves a modified click on the open draft to the browser", () => {
    show();
    const link = screen.getByRole("link", { name: /Product open/ });
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
    });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
  });

  it("opens another draft", async () => {
    show();
    await userEvent.click(screen.getByRole("link", { name: /Product other/ }));
    expect(screen.getByTestId("path")).toHaveTextContent("/drafts/other");
  });
});
