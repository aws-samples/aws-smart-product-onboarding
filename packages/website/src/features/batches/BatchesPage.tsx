/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  SearchField,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components";
import { NewBatchDrawer } from "./NewBatchDrawer";
import { errorMessage, useApi, type BatchExecution } from "../../api/client";
import { MobileActions, PageBar } from "../../layout/AppShell";
import {
  countByGroup,
  filterBatches,
  perDay,
  STATUS_LABEL,
  statusGroup,
  type StatusFilter,
} from "../../lib/batches";
import {
  dayRange,
  formatDateTime,
  formatDuration,
  localDate,
  parseLocalDate,
  relativeTime,
} from "../../lib/time";
import { ErrorAlert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { SelectField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { Spinner } from "../../ui/Spinner";
import { useToast } from "../../ui/Toast";

type Range = "7" | "30" | "all" | "custom";
const RANGES = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom range" },
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const pillClass = {
  ok: "text-ok",
  err: "text-err",
  active: "text-run",
};
const dotClass = { ok: "bg-ok", err: "bg-err", active: "bg-run animate-blink" };

const StatusPill: React.FC<{ batch: BatchExecution }> = ({ batch }) => {
  const g = statusGroup(batch.status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${pillClass[g]}`}
    >
      <span
        className={`size-[7px] rounded-full ${dotClass[g]}`}
        aria-hidden="true"
      />
      {STATUS_LABEL[batch.status]}
    </span>
  );
};

const RowActions: React.FC<{ batch: BatchExecution; onRetry: () => void }> = ({
  batch,
  onRetry,
}) => {
  const { $api } = useApi();
  const notify = useToast();
  const download = $api.useMutation("post", "/downloadFile", {
    onSuccess: (res) => {
      if (res.url) window.location.assign(res.url);
    },
    onError: (e) =>
      notify(errorMessage(e, "The results could not be downloaded."), "error"),
  });
  const short = batch.executionId.slice(0, 8);
  return (
    <span className="flex items-center justify-end gap-1">
      {batch.status === "SUCCESS" && batch.outputKey && (
        <Button
          size="sm"
          variant="quiet"
          isPending={download.isPending}
          onPress={() =>
            download.mutate({
              body: { outputKey: batch.outputKey!, expiration: 300 },
            })
          }
          aria-label={`Download results CSV for batch ${short}`}
        >
          {!download.isPending && <Icon name="download" className="size-3.5" />}
          CSV
        </Button>
      )}
      {batch.status === "ERROR" && (
        <Button
          size="sm"
          variant="quiet"
          onPress={onRetry}
          aria-label={`Start a new batch to retry ${short}`}
        >
          Retry
        </Button>
      )}
      <Button
        size="sm"
        variant="quiet"
        className="px-1.5"
        aria-label={`Copy batch ID ${short}`}
        onPress={() =>
          navigator.clipboard
            .writeText(batch.executionId)
            .then(() => notify("Batch ID copied", "success"))
            .catch(() =>
              notify("Copying is not allowed in this browser.", "error"),
            )
        }
      >
        <Icon name="copy" className="size-3.5" />
      </Button>
    </span>
  );
};

const duration = (b: BatchExecution) =>
  statusGroup(b.status) === "active"
    ? formatDuration(Date.now() - Date.parse(b.createdAt))
    : formatDuration(Date.parse(b.updatedAt) - Date.parse(b.createdAt));

/** Batch list with status counts, filters, search and auto-refresh while batches run. */
export const BatchesPage: React.FC = () => {
  const { $api } = useApi();
  const notify = useToast();
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState(localDate(daysAgo(30)));
  const [to, setTo] = useState(localDate(new Date()));
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const searchRef = useRef<HTMLInputElement>(null);

  // Recomputed when the local day changes, so a page left open keeps covering today.
  const today = localDate(new Date(now));
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);
  const rangeError =
    range !== "custom"
      ? undefined
      : !fromDate || !toDate
        ? "Enter both dates."
        : fromDate > toDate
          ? "The start date must be on or before the end date."
          : undefined;
  const bounds = useMemo(() => {
    if (range === "custom") {
      const f = parseLocalDate(from);
      const t = parseLocalDate(to);
      return f && t && f <= t ? dayRange(f, t) : undefined;
    }
    // "All time" keeps the previous website's window of 1000 days.
    return dayRange(
      daysAgo(range === "all" ? 1000 : Number(range) - 1),
      new Date(`${today}T12:00:00`),
    );
  }, [range, from, to, today]);

  const query = $api.useQuery(
    "get",
    "/listBatchExecutions",
    { params: { query: { start_time: bounds?.start, end_time: bounds?.end } } },
    {
      enabled: !!bounds,
      refetchOnWindowFocus: false,
      refetchInterval: (q) =>
        autoRefresh &&
        q.state.data?.executions.some((b) => statusGroup(b.status) === "active")
          ? 10_000
          : false,
    },
  );
  const all = query.data?.executions ?? [];
  const counts = countByGroup(all);
  const rows = filterBatches(all, filter, search);
  const week = perDay(all, 7);
  const peak = Math.max(1, ...week.map((d) => d.count));
  const live = autoRefresh && counts.active > 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(target?.tagName ?? "") &&
        !document.querySelector("[role=dialog]")
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(t);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const filters: { id: StatusFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.all },
    { id: "active", label: "Running", count: counts.active },
    { id: "ok", label: "Completed", count: counts.ok },
    { id: "err", label: "Failed", count: counts.err },
  ];
  const segment =
    "flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-muted outline-none data-[selected]:bg-accent-soft data-[selected]:text-text data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent [&+&]:border-l [&+&]:border-line-2";

  const clearFilters = () => {
    setFilter("all");
    setSearch("");
  };

  return (
    <>
      <PageBar crumb={<b className="text-text font-semibold">Batches</b>}>
        <Button variant="primary" onPress={() => setDrawerOpen(true)}>
          <Icon name="plus" />
          New batch
        </Button>
      </PageBar>
      <main
        id="main"
        className="mx-auto max-w-[1720px] px-6 pt-5 pb-10 max-md:px-4 max-md:pb-24"
      >
        <h1 className="text-[22px] font-bold tracking-tight">
          Batch onboarding
        </h1>
        <p className="text-muted mb-4 text-[13px]">
          Upload a CSV catalog, with an optional ZIP of images. Each batch
          writes listings, categories and attributes to a results CSV.
        </p>

        <section
          aria-label="Summary"
          className="bg-surface border-line mb-3.5 flex rounded-lg border max-md:flex-wrap"
        >
          {[
            { v: counts.all, k: "Batches in range" },
            { v: counts.active, k: "Running", dot: "bg-run" },
            { v: counts.ok, k: "Completed", dot: "bg-ok" },
            { v: counts.err, k: "Failed", dot: "bg-err" },
          ].map((s, n) => (
            <div
              key={s.k}
              className={`border-line flex-1 px-4 py-3 max-md:basis-1/2 ${n ? "md:border-l" : ""} ${n % 2 ? "max-md:border-l" : ""} ${n > 1 ? "max-md:border-t" : ""}`}
            >
              <div className="font-mono text-[22px] font-medium tracking-tight">
                {query.isLoading || !bounds ? "–" : s.v}
              </div>
              <div className="text-muted flex items-center gap-1.5 text-[12.5px]">
                {s.dot && (
                  <span
                    className={`size-[7px] rounded-full ${s.dot}`}
                    aria-hidden="true"
                  />
                )}
                {s.k}
              </div>
            </div>
          ))}
          {range !== "custom" && (
            <div className="border-line flex-1 border-l px-4 py-3 max-md:hidden">
              <div className="text-muted text-[12.5px]">
                Started, last 7 days
              </div>
              <div
                className="mt-1 flex h-[26px] items-end gap-[3px]"
                role="img"
                aria-label={`Batches started per day, last 7 days: ${week.map((d) => d.count).join(", ")}`}
              >
                {week.map((d) => (
                  <i
                    key={d.day}
                    className="bg-accent w-[7px] rounded-t-[2px] opacity-70"
                    style={{
                      height: `${Math.max(2, (d.count / peak) * 26)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="panel" aria-label="Batch list">
          <div className="border-line flex flex-wrap items-end gap-2 border-b px-3 py-2.5">
            <ToggleButtonGroup
              aria-label="Filter by status"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[filter]}
              onSelectionChange={(k) => {
                const [v] = [...k];
                if (v) setFilter(v as StatusFilter);
              }}
              className="border-line-2 flex overflow-hidden rounded-md border"
            >
              {filters.map((f) => (
                <ToggleButton key={f.id} id={f.id} className={segment}>
                  {f.label}
                  <span className="text-faint font-mono text-[11px]">
                    {f.count}
                  </span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <SearchField
              value={search}
              onChange={setSearch}
              aria-label="Search batch ID"
              className="relative"
            >
              <Icon
                name="search"
                className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              />
              <Input
                ref={searchRef}
                placeholder="Search batch ID"
                className="field-input w-56 py-1.5 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
              />
              <span
                className="kbd pointer-events-none absolute top-1/2 right-2 -translate-y-1/2"
                aria-hidden="true"
              >
                /
              </span>
            </SearchField>
            <SelectField
              label="Date range"
              hideLabel
              value={range}
              options={RANGES}
              onChange={(r) => setRange(r as Range)}
            />
            {range === "custom" && (
              <div className="flex items-end gap-2">
                <div className="grid gap-1">
                  <label htmlFor="from" className="text-muted text-[12px]">
                    From
                  </label>
                  <input
                    id="from"
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                    className="field-input py-1.5"
                  />
                </div>
                <div className="grid gap-1">
                  <label htmlFor="to" className="text-muted text-[12px]">
                    To
                  </label>
                  <input
                    id="to"
                    type="date"
                    value={to}
                    min={from}
                    onChange={(e) => setTo(e.target.value)}
                    className="field-input py-1.5"
                  />
                </div>
                {rangeError && (
                  <p
                    role="alert"
                    className="text-err self-center text-[12.5px]"
                  >
                    {rangeError}
                  </p>
                )}
              </div>
            )}
            <div className="text-muted ml-auto flex items-center gap-2 text-[12.5px] max-md:ml-0">
              <Button
                size="sm"
                variant="quiet"
                className="px-1.5"
                aria-label="Refresh now"
                onPress={() => bounds && void query.refetch()}
                isDisabled={!bounds}
                isPending={query.isFetching}
              >
                {!query.isFetching && (
                  <Icon name="refresh" className="size-3.5" />
                )}
              </Button>
              <span aria-live="polite">
                {query.dataUpdatedAt
                  ? `Updated ${relativeTime(query.dataUpdatedAt, now)}`
                  : ""}
              </span>
              <Switch
                isSelected={autoRefresh}
                onChange={setAutoRefresh}
                className="group flex items-center gap-2"
              >
                <span
                  className="bg-line-2 group-data-[selected]:bg-accent group-data-[focus-visible]:outline-accent relative h-5 w-[34px] rounded-full transition-colors group-data-[focus-visible]:outline-2"
                  aria-hidden="true"
                >
                  <span className="absolute top-[3px] left-[3px] size-3.5 rounded-full bg-white transition-transform group-data-[selected]:translate-x-[14px]" />
                </span>
                Auto-refresh
                {live ? " every 10 s" : counts.active ? "" : " while running"}
              </Switch>
            </div>
          </div>

          {query.isError && (
            <div className="p-4">
              <ErrorAlert
                title="Batches could not be loaded"
                detail={errorMessage(query.error)}
                onRetry={() => void query.refetch()}
              />
            </div>
          )}
          {query.isLoading && (
            <div
              className="text-muted grid place-items-center p-10"
              role="status"
            >
              <Spinner label="Loading batches…" />
            </div>
          )}
          {query.isSuccess && all.length === 0 && (
            <div className="grid place-items-center gap-3 p-10 text-center">
              <p className="font-semibold">No batches in this date range</p>
              <p className="text-muted text-[13px]">
                Start one from a CSV catalog.
              </p>
              <Button variant="primary" onPress={() => setDrawerOpen(true)}>
                New batch
              </Button>
            </div>
          )}
          {query.isSuccess && all.length > 0 && rows.length === 0 && (
            <div className="text-muted grid place-items-center gap-2 p-10 text-center">
              No batches match these filters.
              <Button size="sm" onPress={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
          {rows.length > 0 && (
            <>
              <table className="w-full border-collapse text-[13px] max-md:hidden">
                <caption className="sr-only">
                  Batch executions, newest update first
                </caption>
                <thead>
                  <tr className="bg-raised text-faint font-mono text-[11px] tracking-[0.08em] uppercase">
                    {["Batch ID", "Status", "Started", "Updated"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border-line border-b px-3 py-2.5 text-left font-medium"
                      >
                        {h}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="border-line border-b px-3 py-2.5 text-right font-medium"
                    >
                      Duration
                    </th>
                    <th
                      scope="col"
                      className="border-line border-b px-3 py-2.5"
                    >
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <React.Fragment key={b.executionId}>
                      <tr className="hover:bg-raised [&>td]:border-line [&>td]:border-b">
                        <td
                          className="px-3 py-2 font-mono text-[12.5px]"
                          title={b.executionId}
                        >
                          {b.executionId}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <StatusPill batch={b} />
                        </td>
                        <td className="text-muted px-3 py-2 font-mono text-[12.5px] whitespace-nowrap">
                          {formatDateTime(b.createdAt)}
                        </td>
                        <td className="text-muted px-3 py-2 font-mono text-[12.5px] whitespace-nowrap">
                          {formatDateTime(b.updatedAt)}
                        </td>
                        <td className="text-muted px-3 py-2 text-right font-mono text-[12.5px]">
                          {duration(b)}
                        </td>
                        <td className="px-3 py-1.5">
                          <RowActions
                            batch={b}
                            onRetry={() => setDrawerOpen(true)}
                          />
                        </td>
                      </tr>
                      {b.status === "ERROR" && b.error && (
                        <tr className="[&>td]:border-line [&>td]:border-b">
                          <td
                            colSpan={6}
                            className="text-err px-3 pt-0 pb-2 font-mono text-[12px] whitespace-pre-wrap"
                          >
                            ↳ {b.error}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <ul className="md:hidden" aria-label="Batch executions">
                {rows.map((b) => (
                  <li
                    key={b.executionId}
                    className="border-line grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b px-3 py-2.5 last:border-b-0"
                  >
                    <span
                      className="truncate font-mono text-[12.5px]"
                      title={b.executionId}
                    >
                      {b.executionId}
                    </span>
                    <span className="text-right text-[13px]">
                      <StatusPill batch={b} />
                    </span>
                    <span className="text-muted font-mono text-[12px]">
                      {formatDateTime(b.createdAt)}
                    </span>
                    <span className="text-muted text-right font-mono text-[12px]">
                      {duration(b)}
                    </span>
                    {b.status === "ERROR" && b.error && (
                      <span className="text-err col-span-2 font-mono text-[12px]">
                        ↳ {b.error}
                      </span>
                    )}
                    <span className="col-span-2 [&>span]:justify-start">
                      <RowActions
                        batch={b}
                        onRetry={() => setDrawerOpen(true)}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
      <MobileActions>
        <Button variant="primary" onPress={() => setDrawerOpen(true)}>
          New batch
        </Button>
      </MobileActions>
      <NewBatchDrawer
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        onStarted={(id) => {
          notify(
            id ? `Batch started: ${id.slice(0, 8)}` : "Batch started",
            "success",
          );
          setAutoRefresh(true);
          if (bounds) void query.refetch();
        }}
      />
    </>
  );
};
