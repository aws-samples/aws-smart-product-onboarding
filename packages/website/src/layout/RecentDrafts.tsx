/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useEffect, useState } from "react";
import { Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import { Link } from "react-router-dom";
import {
  clearDrafts,
  draftTitle,
  useActiveDraftId,
  useDrafts,
} from "../lib/drafts";
import { relativeTime } from "../lib/time";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

/** Drafts saved in this browser, newest first, with a confirm-before-clear control. */
export const RecentDrafts: React.FC<{
  variant?: "rail" | "menu";
  onNavigate?: () => void;
}> = ({ variant = "rail", onNavigate }) => {
  const drafts = useDrafts();
  const activeId = useActiveDraftId();
  const notify = useToast();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section
      aria-labelledby={`drafts-heading-${variant}`}
      className={
        variant === "rail"
          ? "mt-2.5 grid min-h-0 gap-0.5 max-md:hidden"
          : "grid gap-0.5"
      }
    >
      <div className="rail-collapsed:hidden flex items-center px-2.5 py-1.5">
        <h2
          id={`drafts-heading-${variant}`}
          className="text-faint font-mono text-[11px] font-medium tracking-[0.1em] uppercase"
        >
          Recent drafts
        </h2>
        {drafts.length > 0 && (
          <DialogTrigger>
            <Button
              variant="quiet"
              size="sm"
              className="text-accent ml-auto px-1 py-0.5"
            >
              Clear all
            </Button>
            <Popover placement="bottom end" className="panel w-64 p-3">
              <Dialog className="outline-none">
                {({ close }) => (
                  <>
                    <Heading slot="title" className="font-semibold">
                      Clear {drafts.length}{" "}
                      {drafts.length === 1 ? "draft" : "drafts"}?
                    </Heading>
                    <p className="text-muted mt-1 text-[13px]">
                      Drafts are kept only in this browser. This can&apos;t be
                      undone.
                    </p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" onPress={close}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onPress={() => {
                          clearDrafts();
                          close();
                          notify("Recent drafts cleared");
                        }}
                      >
                        Clear drafts
                      </Button>
                    </div>
                  </>
                )}
              </Dialog>
            </Popover>
          </DialogTrigger>
        )}
      </div>
      {drafts.length === 0 ? (
        <p className="rail-collapsed:hidden text-muted px-2.5 py-1 text-[12.5px]">
          No drafts yet
        </p>
      ) : (
        <ul className="grid gap-0.5 overflow-y-auto">
          {drafts.map((d) => {
            const title = draftTitle(d);
            const when = relativeTime(d.updatedAt, now);
            const thumb = d.images.find((i) => i.dataUrl)?.dataUrl;
            return (
              <li key={d.id}>
                <Link
                  to={`/drafts/${d.id}`}
                  onClick={onNavigate}
                  title={title}
                  aria-current={d.id === activeId ? "page" : undefined}
                  className="hover:bg-raised aria-[current=page]:bg-raised rail-collapsed:justify-center rail-collapsed:px-0 flex items-center gap-2.5 rounded-md px-2 py-1.5 aria-[current=page]:shadow-[inset_0_0_0_1px_var(--line-2)]"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="bg-img size-8 shrink-0 rounded-[5px] object-contain"
                    />
                  ) : (
                    <span
                      className="bg-raised size-8 shrink-0 rounded-[5px]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="rail-collapsed:sr-only grid min-w-0 leading-tight">
                    <span className="truncate text-[13px] font-medium">
                      {title}
                    </span>
                    <span className="text-muted font-mono text-[11.5px]">
                      <span className="sr-only">Edited </span>
                      {when}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
