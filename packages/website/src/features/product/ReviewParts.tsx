/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useEffect, useState } from "react";
import {
  Button as AriaButton,
  Disclosure,
  DisclosurePanel,
  Heading,
} from "react-aria-components";
import type { FlowImage, ProductFlow, StageStatus } from "./useProductFlow";
import type { ProductAttribute } from "../../api/client";
import { ErrorAlert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { Spinner } from "../../ui/Spinner";

/** Large image with a strip of thumbnails. */
export const Gallery: React.FC<{
  images: FlowImage[];
  frame?: "square" | "wide";
}> = ({ images, frame }) => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (index >= images.length) setIndex(Math.max(0, images.length - 1));
  }, [images.length, index]);
  const current = images[index];
  if (!current) {
    return (
      <section
        className="panel text-muted grid min-h-48 place-items-center p-6"
        aria-label="Product images"
      >
        No images. The listing was generated from the details only.
      </section>
    );
  }
  return (
    <section className="panel p-3" aria-label="Product images">
      <div
        className={`bg-img relative overflow-hidden rounded-md ${
          frame === "wide"
            ? "aspect-[4/3]"
            : "aspect-[4/3] @min-[1380px]/review:aspect-auto @min-[1380px]/review:h-[min(64vh,620px)]"
        }`}
      >
        <span className="absolute top-2.5 left-2.5 z-10 rounded bg-[#0b0f14]/80 px-1.5 py-0.5 font-mono text-[11px] text-[#e6edf5]">
          {index + 1} / {images.length}
        </span>
        {current.url ? (
          <img
            src={current.url}
            alt={`Product image ${index + 1} of ${images.length}`}
            className="absolute inset-0 size-full object-contain p-[4%]"
          />
        ) : (
          <span
            role="img"
            aria-label={`Product image ${index + 1} of ${images.length}, preview not saved`}
            className="text-faint bg-raised absolute inset-0 grid place-items-center p-6 text-center text-[13px]"
          >
            This browser ran out of space, so the preview was not saved. The
            image is still used for generation.
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(64px,96px))] gap-2"
          role="group"
          aria-label="Choose image"
        >
          {images.map((img, n) => (
            <button
              key={img.id}
              type="button"
              aria-pressed={n === index}
              aria-label={`Image ${n + 1}`}
              onClick={() => setIndex(n)}
              className="bg-img border-line aria-pressed:border-accent aspect-square rounded-md border p-1 aria-pressed:shadow-[0_0_0_1px_var(--accent)]"
            >
              {img.url ? (
                <img
                  src={img.url}
                  alt=""
                  className="size-full object-contain"
                />
              ) : (
                <span className="bg-raised block size-full rounded" />
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

/** Editable title and description, with token usage. */
export const ListingPanel: React.FC<{
  flow: ProductFlow;
  onRegenerate?: () => void;
  clampDescription?: boolean;
}> = ({ flow, onRegenerate, clampDescription }) => {
  const [expanded, setExpanded] = useState(!clampDescription);
  const { product, usage } = flow;
  const words =
    product?.description?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return (
    <section className="panel" aria-labelledby="listing-heading">
      <header className="border-line flex items-center gap-2.5 border-b px-4 py-3">
        <h2 id="listing-heading" className="eyebrow">
          Listing content
        </h2>
        {onRegenerate && (
          <Button
            variant="quiet"
            size="sm"
            className="ml-auto"
            onPress={onRegenerate}
            isPending={flow.generating}
            isDisabled={flow.classifying}
            aria-label="Regenerate listing text"
          >
            {!flow.generating && <Icon name="refresh" className="size-3.5" />}
            Regenerate
          </Button>
        )}
      </header>
      <div className="grid gap-4 p-4">
        {flow.generating ? (
          <div
            className="grid gap-3"
            role="status"
            aria-label="Generating listing"
          >
            <p className="text-muted flex items-center gap-2 text-[13px]">
              <Spinner />
              {flow.genStatus === "preparing"
                ? "Preparing images…"
                : flow.genStatus === "uploading"
                  ? "Uploading images…"
                  : "Writing the listing…"}
            </p>
            <div className="skeleton h-6 w-3/4" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-5/6" />
          </div>
        ) : product ? (
          <>
            <TextField
              label="Title"
              multiline
              rows={2}
              value={product.title}
              onChange={(title) => flow.updateProduct({ title })}
              inputClassName="text-[19px] font-bold leading-snug tracking-tight [field-sizing:content] resize-none"
            />
            {expanded ? (
              <TextField
                label="Description"
                multiline
                rows={10}
                value={product.description}
                onChange={(description) => flow.updateProduct({ description })}
                inputClassName="leading-relaxed [field-sizing:content] min-h-40"
              />
            ) : (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold">Description</p>
                <div
                  id="description-text"
                  className="clamp-fade max-h-[12em] overflow-hidden"
                >
                  {product.description.split(/\n+/).map((para, n) => (
                    <p key={n} className="mb-2.5 opacity-95">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {clampDescription && (
              <button
                type="button"
                className="text-accent justify-self-start text-[13px] font-semibold hover:underline"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? "Show less" : "Show and edit full description"}
              </button>
            )}
          </>
        ) : (
          <p className="text-muted">No listing yet.</p>
        )}
        {flow.genStatus === "error" && (
          <ErrorAlert
            title="The listing could not be generated"
            detail={flow.genError}
            onRetry={() => void flow.generate()}
          />
        )}
      </div>
      {usage && !flow.generating && product && (
        <footer className="border-line text-muted flex flex-wrap gap-4 border-t px-4 py-2.5 text-[12.5px]">
          <span>
            Input{" "}
            <b className="text-text font-mono font-medium">
              {usage.inputTokens.toLocaleString("en")}
            </b>
          </span>
          {usage.outputTokens !== undefined && (
            <span>
              Output{" "}
              <b className="text-text font-mono font-medium">
                {usage.outputTokens.toLocaleString("en")}
              </b>
            </span>
          )}
          <span>
            Words <b className="text-text font-mono font-medium">{words}</b>
          </span>
        </footer>
      )}
    </section>
  );
};

const STAGE_LABELS = {
  metaclass: "Find candidate categories",
  categorize: "Choose the category",
  attributes: "Extract attributes",
} as const;

export const StageList: React.FC<{ stages: ProductFlow["stages"] }> = ({
  stages,
}) => (
  <ol className="grid gap-2" aria-label="Progress">
    {(Object.keys(STAGE_LABELS) as (keyof typeof STAGE_LABELS)[]).map((k) => {
      const s: StageStatus = stages[k];
      return (
        <li key={k} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={`grid size-5 place-items-center rounded-full border ${
              s === "done"
                ? "border-ok text-ok"
                : s === "error"
                  ? "border-err text-err"
                  : s === "running"
                    ? "border-run text-run"
                    : "border-line-2 text-faint"
            }`}
            aria-hidden="true"
          >
            {s === "done" ? (
              <Icon name="check" className="size-3" />
            ) : s === "running" ? (
              <Spinner />
            ) : s === "error" ? (
              "!"
            ) : null}
          </span>
          <span className={s === "idle" ? "text-muted" : ""}>
            {STAGE_LABELS[k]}
          </span>
          <span className="sr-only">
            {s === "done"
              ? "done"
              : s === "running"
                ? "in progress"
                : s === "error"
                  ? "failed"
                  : "waiting"}
          </span>
        </li>
      );
    })}
  </ol>
);

const MISSING = /^(unidentified|)$/i;

export const AttributesTable: React.FC<{ attributes: ProductAttribute[] }> = ({
  attributes,
}) =>
  attributes.length === 0 ? (
    <p className="text-muted text-[13px]">
      No attributes are defined for this category.
    </p>
  ) : (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">Extracted attributes</caption>
      <tbody>
        {attributes.map((a, n) => (
          <tr
            key={`${a.name}-${n}`}
            className="border-line [&+&]:border-t [&+&]:border-dashed"
          >
            <th
              scope="row"
              className="text-muted w-[46%] py-2 pr-3 text-left align-top font-medium"
            >
              {a.name}
            </th>
            <td className="py-2 font-semibold break-words">
              {MISSING.test(a.value.trim()) ? (
                <span className="text-faint font-medium italic">
                  Not found in source
                </span>
              ) : (
                a.value
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

const Details: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Disclosure className="group mt-2.5">
    <Heading className="m-0">
      <AriaButton
        slot="trigger"
        className="flex items-center gap-1.5 rounded text-[13px] font-semibold outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent"
      >
        <Icon
          name="chevronRight"
          className="size-3.5 transition-transform group-data-[expanded]:rotate-90"
        />
        {title}
      </AriaButton>
    </Heading>
    <DisclosurePanel className="text-muted mt-1.5 hidden text-[13px] group-data-[expanded]:block">
      {children}
    </DisclosurePanel>
  </Disclosure>
);

/** Category path, explanation and attributes. */
export const ClassificationDetails: React.FC<{
  flow: ProductFlow;
  layout: "stack" | "columns";
  showRegenerate?: boolean;
}> = ({ flow, layout, showRegenerate }) => {
  const { classification, attributes, stages, possibleCategories } = flow;
  const path = (
    classification?.categoryPath ||
    classification?.categoryName ||
    ""
  )
    .split(/\s*>\s*/)
    .filter(Boolean);
  return (
    <div
      className={
        layout === "columns"
          ? "grid @min-[760px]/review:grid-cols-[1fr_1.25fr]"
          : "grid"
      }
    >
      <section
        className="border-line px-4 py-3.5 [&+&]:border-t"
        aria-labelledby="category-heading"
      >
        <div className="mb-2.5 flex items-center">
          <h3 id="category-heading" className="eyebrow">
            Category
          </h3>
          {showRegenerate && (
            <Button
              variant="quiet"
              size="sm"
              className="ml-auto px-1.5"
              onPress={() => void flow.classify()}
              isDisabled={flow.classifying}
              aria-label="Regenerate category and attributes"
            >
              <Icon name="refresh" className="size-3.5" />
            </Button>
          )}
        </div>
        {stages.metaclass === "running" || stages.categorize === "running" ? (
          <Spinner label="Categorizing…" className="text-muted text-[13px]" />
        ) : classification ? (
          <>
            <ol
              className="border-line-2 text-muted grid gap-1 border-l pl-3 text-[13px]"
              aria-label="Category path"
            >
              {path.map((p, n) => (
                <li
                  key={n}
                  className={
                    n === path.length - 1
                      ? "text-text relative font-semibold before:absolute before:top-[7px] before:-left-4 before:size-[7px] before:rounded-full before:bg-[var(--accent)]"
                      : ""
                  }
                >
                  {p}
                </li>
              ))}
            </ol>
            <p className="text-muted mt-2.5 flex flex-wrap items-center gap-2 text-[12.5px]">
              ID{" "}
              <span className="bg-raised border-line text-text rounded border px-1.5 font-mono">
                {classification.categoryId}
              </span>
              {possibleCategories && (
                <span>
                  · chosen from {possibleCategories.length} candidates
                </span>
              )}
            </p>
            {classification.explanation && (
              <Details title="Why this category">
                {classification.explanation}
              </Details>
            )}
            {classification.prompt && (
              <Details title="Model prompt">
                <pre className="bg-bg border-line max-h-64 overflow-auto rounded border p-2 font-mono text-[11.5px] whitespace-pre-wrap">
                  {classification.prompt}
                </pre>
              </Details>
            )}
          </>
        ) : (
          <p className="text-muted text-[13px]">Not categorized yet.</p>
        )}
      </section>
      <section
        className={`border-line px-4 py-3.5 ${layout === "columns" ? "border-t @min-[760px]/review:border-t-0 @min-[760px]/review:border-l" : "border-t"}`}
        aria-labelledby="attributes-heading"
      >
        <div className="mb-2 flex items-center">
          <h3 id="attributes-heading" className="eyebrow">
            Attributes{attributes ? ` · ${attributes.length}` : ""}
          </h3>
          {showRegenerate && classification && (
            <Button
              variant="quiet"
              size="sm"
              className="ml-auto px-1.5"
              onPress={() => void flow.extract()}
              isDisabled={flow.classifying}
              aria-label="Regenerate attributes"
            >
              <Icon name="refresh" className="size-3.5" />
            </Button>
          )}
        </div>
        {stages.attributes === "running" ? (
          <Spinner
            label="Extracting attributes…"
            className="text-muted text-[13px]"
          />
        ) : attributes ? (
          <AttributesTable attributes={attributes} />
        ) : (
          <p className="text-muted text-[13px]">No attributes yet.</p>
        )}
      </section>
    </div>
  );
};
