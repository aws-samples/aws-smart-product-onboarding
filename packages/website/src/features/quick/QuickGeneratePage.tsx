/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useState } from "react";
import { MobileActions, PageBar } from "../../layout/AppShell";
import { Button } from "../../ui/Button";
import { TextField } from "../../ui/Field";
import { Icon } from "../../ui/Icon";
import { AdvancedOptions } from "../product/AdvancedOptions";
import { ImageInput } from "../product/ImageInput";
import { useListingActions } from "../product/ProductPage";
import { ListingPanel } from "../product/ReviewParts";
import { useProductFlow } from "../product/useProductFlow";

/** Generates listing text only, without categorization or drafts. */
const QuickGenerate: React.FC<{ onReset: () => void }> = ({ onReset }) => {
  const flow = useProductFlow({ persist: false });
  const { copy } = useListingActions(flow, { canDownload: false });
  // Copy only what the current images and metadata produced.
  const copyBlocked = flow.generating || flow.generationStale;
  const hasResult =
    !!flow.product || flow.generating || flow.genStatus === "error";

  return (
    <>
      <PageBar
        crumb={<b className="text-text font-semibold">Quick generate</b>}
      >
        {flow.product && (
          <>
            <Button variant="quiet" onPress={onReset}>
              Start over
            </Button>
            <Button onPress={() => void copy()} isDisabled={copyBlocked}>
              Copy JSON
            </Button>
          </>
        )}
      </PageBar>
      <main
        id="main"
        className="mx-auto max-w-[1720px] px-6 pt-5 pb-10 max-md:px-4 max-md:pb-24"
      >
        <h1 className="text-[22px] font-bold tracking-tight">Quick generate</h1>
        <p className="text-muted mb-4 text-[13px]">
          Write a title and description from images and details, without
          categorizing or saving a draft.
        </p>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section
            className="panel grid gap-4 p-4"
            aria-labelledby="quick-input"
          >
            <h2 id="quick-input" className="eyebrow">
              Input
            </h2>
            <ImageInput flow={flow} />
            <TextField
              label="Product metadata"
              description="Optional details the images don't show."
              multiline
              rows={4}
              value={flow.metadata}
              onChange={flow.setMetadata}
            />
            <AdvancedOptions flow={flow} />
            {flow.generationStale && (
              <p className="text-muted text-[13px]" role="status">
                The images or metadata changed. Generate again before you copy
                the listing.
              </p>
            )}
            <Button
              variant="primary"
              className="justify-self-end"
              isDisabled={!flow.canGenerate}
              isPending={flow.generating}
              onPress={() => void flow.generate()}
            >
              <Icon name="sparkle" />
              {flow.product ? "Generate again" : "Generate"}
            </Button>
          </section>
          {hasResult ? (
            <ListingPanel flow={flow} />
          ) : (
            <section
              className="panel text-muted grid min-h-64 place-items-center p-6 text-center"
              aria-label="Result"
            >
              The generated title and description appear here.
            </section>
          )}
        </div>
      </main>
      {flow.product && (
        <MobileActions>
          <Button variant="quiet" onPress={onReset}>
            Start over
          </Button>
          <Button onPress={() => void copy()} isDisabled={copyBlocked}>
            Copy JSON
          </Button>
        </MobileActions>
      )}
    </>
  );
};

export const QuickGeneratePage: React.FC = () => {
  const [key, setKey] = useState(0);
  return <QuickGenerate key={key} onReset={() => setKey((k) => k + 1)} />;
};
