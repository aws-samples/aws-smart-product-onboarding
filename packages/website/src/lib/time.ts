/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

const rtf = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "short",
});

/** "just now", "5 min. ago", "2 hr. ago", "yesterday", "3 days ago". */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = (timestamp - now) / 1000;
  if (seconds > -60) return "just now";
  if (seconds > -3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (seconds > -86400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86400), "day");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local date as YYYY-MM-DD. */
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The local UTC offset as +HH:MM, for the time range sent to the API. */
export function localOffset(d: Date): string {
  const minutes = -d.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** ISO 8601 bounds covering whole local days, as the batch list API expects. */
export function dayRange(from: Date, to: Date): { start: string; end: string } {
  return {
    start: `${localDate(from)}T00:00:00${localOffset(from)}`,
    end: `${localDate(to)}T23:59:59${localOffset(to)}`,
  };
}

export function formatDateTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (localDate(d) === localDate(now)) return time;
  return `${d.toLocaleDateString("en", { month: "short", day: "numeric" })} ${time}`;
}

/** "45s", "2m 04s", "1h 03m". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
}
