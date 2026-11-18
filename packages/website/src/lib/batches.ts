/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { localDate } from "./time";
import type { BatchExecution, BatchExecutionStatus } from "../api/client";

export type StatusGroup = "active" | "ok" | "err";
export type StatusFilter = "all" | StatusGroup;

export const statusGroup = (status: BatchExecutionStatus): StatusGroup =>
  status === "SUCCESS" ? "ok" : status === "ERROR" ? "err" : "active";

export const STATUS_LABEL: Record<BatchExecutionStatus, string> = {
  STARTED: "Started",
  QUEUED: "Queued",
  WAITING: "Waiting",
  RUNNING: "Running",
  SUCCESS: "Completed",
  ERROR: "Failed",
};

export function countByGroup(items: BatchExecution[]) {
  const counts = { all: items.length, active: 0, ok: 0, err: 0 };
  for (const b of items) counts[statusGroup(b.status)]++;
  return counts;
}

export function filterBatches(
  items: BatchExecution[],
  filter: StatusFilter,
  search: string,
) {
  const q = search.trim().toLowerCase();
  return items
    .filter(
      (b) =>
        (filter === "all" || statusGroup(b.status) === filter) &&
        b.executionId.toLowerCase().includes(q),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** Batches started on each of the last `days` local days, oldest first. */
export function perDay(
  items: BatchExecution[],
  days: number,
  now = new Date(),
): { day: string; count: number }[] {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return { day: localDate(d), count: 0 };
  });
  for (const b of items) {
    const day = localDate(new Date(b.createdAt));
    const slot = out.find((o) => o.day === day);
    if (slot) slot.count++;
  }
  return out;
}
