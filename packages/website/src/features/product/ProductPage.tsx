/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { useNavigate } from "react-router-dom";
import { AdvancedOptions } from "./AdvancedOptions";
import { ImageInput } from "./ImageInput";
import { modelLabel } from "./models";
import {
  ClassificationDetails,
  Gallery,
  ListingPanel,
  StageList,
} from "./ReviewParts";
import { STEPS, useProductFlow, type ProductFlow } from "./useProductFlow";
import { MobileActions, newProductLink, PageBar } from "../../layout/AppShell";
import { downloadBlob } from "../../lib/images";
import { useStoredState } from "../../lib/storage";
import { ErrorAlert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { useToast } from "../../ui/Toast";

export const listingJson = (flow: ProductFlow) => ({
  product: { ...flow.product, metadata: flow.metadata || undefined },
  category: flow.classification
    ? {
        id: flow.classification.categoryId,
        name: flow.classification.categoryName,
        path: flow.classification.categoryPath,
      }
    : undefined,
  attributes: flow.attributes,
  images: flow.images.map((i) => i.key).filter(Boolean),
});

const slug = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "product";

/** Copy and download actions shared by the review screen and Quick generate. */
export function useListingActions(
  flow: ProductFlow,
  { canDownload = true } = {},
) {
  const notify = useToast();
  return {
    copy: async () => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(listingJson(flow), null, 2),
        );
        notify("Listing JSON copied", "success");
      } catch {
        notify(
          canDownload
            ? "Copying is not allowed in this browser. Use Download instead."
            : "Copying is not allowed in this browser.",
          "error",
        );
      }
    },
    download: () => {
      downloadBlob(
        new Blob([JSON.stringify(listingJson(flow), null, 2)], {
          type: "application/json",
        }),
        `listing-${slug(flow.product?.title)}.json`,
      );
      notify("Listing downloaded", "success");
    },
  };
}

/** Moves to a step. Opening the category step starts categorization when it hasn't run for this listing. */
const goToStep = (flow: ProductFlow, n: number) => {
  flow.setStep(n);
  if (
    n === 2 &&
    (!flow.classification || flow.classificationStale) &&
    !flow.classifying
  )
    void flow.classify();
};

/** Shown when the listing was edited after the category and attributes were computed. */
const StaleNotice: React.FC<{ flow: ProductFlow }> = ({ flow }) =>
  flow.classificationStale ? (
    <div
      role="status"
      className="border-run bg-run-soft mb-4 flex flex-wrap items-center gap-3 rounded-md border p-3 text-[13px]"
    >
      <Icon name="alert" className="text-run" />
      <span className="flex-1">
        The listing changed after it was categorized. Categorize it again before
        you export it.
      </span>
      <Button
        size="sm"
        onPress={() => void flow.classify()}
        isDisabled={flow.classifying}
      >
        <Icon name="refresh" className="size-3.5" />
        Categorize again
      </Button>
    </div>
  ) : null;

const Steps: React.FC<{ flow: ProductFlow }> = ({ flow }) => {
  const reachable = [
    true,
    !!flow.product || flow.generating,
    !!flow.product && !flow.generating,
    flow.classified && !flow.classifying && !flow.generating,
  ];
  return (
    <nav aria-label="Steps" className="max-md:w-full max-md:overflow-x-auto">
      <ol className="bg-surface border-line flex w-fit gap-0.5 rounded-full border p-[3px]">
        {STEPS.map((label, n) => {
          const current = n === flow.step;
          const done = n < flow.step || (n === 3 && current);
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable[n] || current}
                aria-current={current ? "step" : undefined}
                onClick={() => goToStep(flow, n)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap ${
                  current
                    ? "bg-raised text-text font-semibold shadow-[0_0_0_1px_var(--line-2)]"
                    : reachable[n]
                      ? "text-muted hover:text-text"
                      : "text-faint"
                }`}
              >
                <span
                  className={`font-mono text-[11px] ${done && !current ? "text-ok" : ""}`}
                >
                  {String(n + 1).padStart(2, "0")}
                  {n < flow.step ? " ✓" : ""}
                </span>
                <span className={current ? "" : "max-md:sr-only"}>{label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

const StepFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
    {children}
  </div>
);

const ImagesStep: React.FC<{ flow: ProductFlow }> = ({ flow }) => (
  <>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section
        className="panel grid content-start gap-3 p-4"
        aria-labelledby="images-heading"
      >
        <h2 id="images-heading" className="eyebrow">
          Product images
        </h2>
        <ImageInput flow={flow} />
      </section>
      <section
        className="panel grid content-start gap-4 p-4"
        aria-labelledby="details-heading"
      >
        <h2 id="details-heading" className="eyebrow">
          Details
        </h2>
        <TextField
          label="Product metadata"
          description="Optional. Anything the images don't show: brand, model number, materials, size, bullet points."
          multiline
          rows={6}
          value={flow.metadata}
          onChange={flow.setMetadata}
        />
        <AdvancedOptions flow={flow} />
      </section>
    </div>
    <StepFooter>
      {!flow.canGenerate && !flow.languageError && (
        <span className="text-muted mr-auto text-[13px]">
          Add at least one image or some product metadata.
        </span>
      )}
      <Button
        variant="primary"
        isDisabled={!flow.canGenerate}
        isPending={flow.generating}
        onPress={() => {
          flow.setStep(1);
          void flow.generate();
        }}
      >
        Generate listing
        <Icon name="chevronRight" />
      </Button>
    </StepFooter>
  </>
);

const GenerateStep: React.FC<{ flow: ProductFlow }> = ({ flow }) => (
  <>
    <div className="@container/review grid gap-4 @min-[760px]/review:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Gallery images={flow.images} frame="wide" />
      <ListingPanel flow={flow} onRegenerate={() => void flow.generate()} />
    </div>
    <StepFooter>
      <Button onPress={() => flow.setStep(0)}>Back</Button>
      <Button
        variant="primary"
        isDisabled={!flow.product || flow.generating}
        onPress={() => {
          flow.setStep(2);
          if (!flow.classification || flow.classificationStale)
            void flow.classify();
        }}
      >
        Categorize
        <Icon name="chevronRight" />
      </Button>
    </StepFooter>
  </>
);

const ClassifyStep: React.FC<{ flow: ProductFlow }> = ({ flow }) => (
  <>
    <div className="@container/review grid gap-4 @min-[760px]/review:grid-cols-[minmax(260px,0.6fr)_minmax(0,1.4fr)]">
      <section
        className="panel grid content-start gap-4 p-4"
        aria-labelledby="progress-heading"
      >
        <h2 id="progress-heading" className="eyebrow">
          Progress
        </h2>
        <StageList stages={flow.stages} />
        {flow.classifyError && (
          <ErrorAlert
            title="Categorization did not finish"
            detail={flow.classifyError}
            onRetry={() => void flow.retryClassification()}
          />
        )}
        {flow.product && (
          <div className="border-line border-t pt-3">
            <p className="text-muted text-[12.5px]">Listing</p>
            <p className="font-semibold">{flow.product.title}</p>
          </div>
        )}
      </section>
      <section
        className="panel @container/review"
        aria-label="Category and attributes"
      >
        <ClassificationDetails flow={flow} layout="columns" />
      </section>
    </div>
    <StepFooter>
      <Button onPress={() => flow.setStep(1)}>Back</Button>
      <Button
        variant="secondary"
        onPress={() => void flow.classify()}
        isDisabled={flow.classifying || !flow.product}
      >
        <Icon name="refresh" />
        Run again
      </Button>
      <Button
        variant="primary"
        isDisabled={!flow.classified || flow.classifying}
        onPress={() => flow.setStep(3)}
      >
        Review
        <Icon name="chevronRight" />
      </Button>
    </StepFooter>
  </>
);

const Inspector: React.FC<{
  flow: ProductFlow;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}> = ({ flow, collapsed, setCollapsed }) => {
  const leaf = (flow.classification?.categoryPath || "").split(/\s*>\s*/).pop();
  const missing =
    flow.attributes?.filter((a) => /^(unidentified|)$/i.test(a.value.trim()))
      .length ?? 0;
  return (
    <aside
      aria-label="Category and attributes"
      className={`panel group/insp col-span-full ${
        collapsed
          ? "@min-[1380px]/review:col-span-1 @min-[1380px]/review:sticky @min-[1380px]/review:top-[72px] @min-[1380px]/review:self-start"
          : "@min-[1380px]/review:sticky @min-[1380px]/review:top-[72px] @min-[1380px]/review:col-span-1 @min-[1380px]/review:self-start"
      }`}
    >
      <header
        className={`border-line flex items-center gap-2.5 px-4 py-3 ${collapsed ? "@min-[1380px]/review:flex-col-reverse @min-[1380px]/review:justify-end @min-[1380px]/review:gap-3.5 @min-[1380px]/review:px-1.5 @min-[1380px]/review:py-2.5" : "border-b"}`}
      >
        <h2
          className={`eyebrow ${collapsed ? "@min-[1380px]/review:[writing-mode:vertical-rl] @min-[1380px]/review:rotate-180" : ""}`}
        >
          Category &amp; attributes
        </h2>
        {collapsed && (
          <span className="text-muted min-w-0 truncate text-[13px] @min-[1380px]/review:hidden">
            <b className="text-text font-semibold">{leaf}</b>
            {flow.attributes &&
              ` · ${flow.attributes.length} attributes${missing ? `, ${missing} not found` : ""}`}
          </span>
        )}
        <Button
          variant="quiet"
          size="sm"
          className={`ml-auto shrink-0 ${collapsed ? "@min-[1380px]/review:m-0 @min-[1380px]/review:px-1.5" : ""}`}
          aria-expanded={!collapsed}
          aria-controls="inspector-body"
          aria-label={`${collapsed ? "Expand" : "Collapse"} category and attributes`}
          onPress={() => setCollapsed(!collapsed)}
        >
          <Icon
            name="chevronDown"
            className={`size-3.5 ${collapsed ? "" : "rotate-180"} ${collapsed ? "@min-[1380px]/review:rotate-90" : "@min-[1380px]/review:-rotate-90"}`}
          />
          <span className={collapsed ? "@min-[1380px]/review:hidden" : ""}>
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </Button>
      </header>
      <div id="inspector-body" hidden={collapsed} className="@container/review">
        <ClassificationDetails flow={flow} layout="columns" showRegenerate />
      </div>
    </aside>
  );
};

const RegenerateMenu: React.FC<{ flow: ProductFlow }> = ({ flow }) => (
  <MenuTrigger>
    <Button isDisabled={flow.generating || flow.classifying}>
      Regenerate
      <Icon name="chevronDown" className="size-3.5" />
    </Button>
    <Popover placement="bottom end" className="panel min-w-56 p-1">
      <Menu
        className="outline-none"
        onAction={(key) => {
          if (key === "text") void flow.generate();
          if (key === "classify") void flow.classify();
          if (key === "attributes") void flow.extract();
        }}
      >
        {[
          ["text", "Listing text"],
          ["classify", "Category and attributes"],
          ["attributes", "Attributes only"],
        ].map(([id, label]) => (
          <MenuItem
            key={id}
            id={id}
            className="data-[focused]:bg-accent-soft cursor-default rounded px-2.5 py-2 text-[13px] font-medium outline-none"
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </Popover>
  </MenuTrigger>
);

const ReviewStep: React.FC<{ flow: ProductFlow }> = ({ flow }) => {
  const [collapsed, setCollapsed] = useStoredState(
    "spo:inspector-collapsed",
    false,
  );
  return (
    <div className="@container/review">
      <div
        className={`grid items-start gap-4 @min-[760px]/review:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] ${
          collapsed
            ? "@min-[1380px]/review:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_52px]"
            : "@min-[1380px]/review:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_360px]"
        }`}
      >
        <Gallery images={flow.images} />
        <ListingPanel flow={flow} clampDescription />
        <Inspector
          flow={flow}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </div>
      {flow.classifyError && (
        <div className="mt-4">
          <ErrorAlert
            title="Categorization did not finish"
            detail={flow.classifyError}
            onRetry={() => void flow.retryClassification()}
          />
        </div>
      )}
    </div>
  );
};

/** Single-product onboarding: images and details, generate, categorize, review. */
export const ProductPage: React.FC<{ draftId?: string }> = ({ draftId }) => {
  const notify = useToast();
  const warned = useRef(false);
  const onSaveFailed = useCallback(() => {
    if (warned.current) return;
    warned.current = true;
    notify(
      "This browser has no space left to save the draft. Download the listing to keep it.",
      "error",
    );
  }, [notify]);
  const flow = useProductFlow({ draftId, persist: true, onSaveFailed });
  const navigate = useNavigate();
  const exportBlocked =
    flow.generating ||
    flow.classifying ||
    flow.classificationStale ||
    !flow.classified;
  const { copy, download } = useListingActions(flow);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [flow.step]);

  const titles = [
    "New product",
    "Generated listing",
    "Category & attributes",
    "Review listing",
  ];
  const onReview = flow.step === 3;
  const startOver = () =>
    void navigate(newProductLink().pathname, { state: newProductLink().state });

  return (
    <>
      <PageBar
        crumb={
          <>
            New product /{" "}
            <b className="text-text font-semibold">{STEPS[flow.step]}</b>
          </>
        }
      >
        {onReview ? (
          <>
            <RegenerateMenu flow={flow} />
            <Button onPress={() => void copy()} isDisabled={exportBlocked}>
              Copy JSON
            </Button>
            <Button
              variant="primary"
              onPress={download}
              isDisabled={exportBlocked}
            >
              <Icon name="download" />
              Download listing
            </Button>
          </>
        ) : (
          flow.product && (
            <Button variant="quiet" onPress={startOver}>
              Start a new product
            </Button>
          )
        )}
      </PageBar>
      <main
        id="main"
        className="mx-auto max-w-[1720px] px-6 pt-5 pb-10 max-md:px-4 max-md:pb-24"
      >
        <div className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="mr-auto">
            <h1
              ref={heading}
              tabIndex={-1}
              className="text-[22px] font-bold tracking-tight outline-none"
            >
              {titles[flow.step]}
            </h1>
            <p className="text-muted text-[13px]">
              {[
                `${flow.images.length} ${flow.images.length === 1 ? "image" : "images"}`,
                flow.modelId ? modelLabel(flow.modelId) : undefined,
                flow.product
                  ? `${flow.options.language.trim() || "English"}, ${flow.options.descriptionLength}`
                  : "Images and details go to Amazon Bedrock to write the listing",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Steps flow={flow} />
        </div>
        {(flow.step === 2 || flow.step === 3) && <StaleNotice flow={flow} />}
        {flow.step === 0 && <ImagesStep flow={flow} />}
        {flow.step === 1 && <GenerateStep flow={flow} />}
        {flow.step === 2 && <ClassifyStep flow={flow} />}
        {flow.step === 3 && <ReviewStep flow={flow} />}
      </main>
      {onReview && (
        <MobileActions>
          <RegenerateMenu flow={flow} />
          <Button onPress={() => void copy()} isDisabled={exportBlocked}>
            Copy
          </Button>
          <Button
            variant="primary"
            onPress={download}
            isDisabled={exportBlocked}
          >
            Download
          </Button>
        </MobileActions>
      )}
    </>
  );
};
