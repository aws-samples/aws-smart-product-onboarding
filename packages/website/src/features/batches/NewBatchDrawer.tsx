/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useEffect, useState } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  Text,
  type DropItem,
  type FileDropItem,
} from "react-aria-components";
import { errorMessage, uploadFile, useApi } from "../../api/client";
import {
  isCsvFile,
  isZipFile,
  SAMPLE_CSV,
  summarizeCsv,
  validateCatalog,
  type CsvSummary,
} from "../../lib/csv";
import { downloadBlob } from "../../lib/images";
import { ErrorAlert } from "../../ui/Alert";
import { Button, buttonClass } from "../../ui/Button";
import { ModalPanel } from "../../ui/Dialog";
import { Icon } from "../../ui/Icon";
import { Section } from "../product/AdvancedOptions";

const firstFile = async (items: DropItem[]) => {
  const item = items.find((i): i is FileDropItem => i.kind === "file");
  return item ? item.getFile() : undefined;
};

const FilePicker: React.FC<{
  label: string;
  hint: React.ReactNode;
  required?: boolean;
  file?: File;
  accept: string[];
  ok?: boolean;
  summary?: React.ReactNode;
  error?: string;
  onFile: (f: File | undefined) => void;
}> = ({ label, hint, required, file, accept, ok, summary, error, onFile }) => (
  <div className="grid gap-1.5">
    <span className="text-[13px] font-semibold">
      {label}{" "}
      <span className="text-muted font-normal">
        ({required ? "required" : "optional"})
      </span>
    </span>
    <DropZone
      aria-label={`${label} drop zone`}
      onDrop={async (e) => onFile(await firstFile(e.items))}
      className={`grid gap-1.5 rounded-lg border p-4 data-[drop-target]:border-accent ${
        file && ok
          ? "border-ok bg-ok-soft"
          : error
            ? "border-err bg-err-soft"
            : "border-line-2 bg-bg border-dashed"
      }`}
    >
      {file ? (
        <>
          <Text slot="label" className="font-semibold break-all">
            {file.name}
          </Text>
          {summary}
          <div className="flex gap-2">
            <FileTrigger
              acceptedFileTypes={accept}
              onSelect={(l) => l?.[0] && onFile(l[0])}
            >
              <AriaButton className={buttonClass("secondary", "sm")}>
                Replace
              </AriaButton>
            </FileTrigger>
            <Button
              size="sm"
              variant="quiet"
              onPress={() => onFile(undefined)}
              aria-label={`Remove ${file.name}`}
            >
              Remove
            </Button>
          </div>
        </>
      ) : (
        <>
          <Text slot="label" className="font-semibold">
            Drop the file here
          </Text>
          <span className="text-muted text-[12.5px]">{hint}</span>
          <FileTrigger
            acceptedFileTypes={accept}
            onSelect={(l) => l?.[0] && onFile(l[0])}
          >
            <AriaButton
              className={`${buttonClass("secondary", "sm")} justify-self-start`}
            >
              <Icon name="upload" className="size-3.5" />
              Choose file
            </AriaButton>
          </FileTrigger>
        </>
      )}
    </DropZone>
    {error && (
      <p className="text-err text-[12.5px]" role="alert">
        {error}
      </p>
    )}
  </div>
);

/** Upload a catalog CSV and an optional images ZIP, then start a batch. */
export const NewBatchDrawer: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (executionId?: string) => void;
}> = ({ isOpen, onOpenChange, onStarted }) => {
  const { $api, fetchClient } = useApi();
  const [csv, setCsv] = useState<File>();
  const [zip, setZip] = useState<File>();
  // The summary records which file it describes, so a replacement file is never submitted on an old check.
  const [summary, setSummary] = useState<{ file: File; csv: CsvSummary }>();
  const [csvError, setCsvError] = useState<string>();
  const [zipError, setZipError] = useState<string>();
  const [submitError, setSubmitError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const create = $api.useMutation("post", "/createBatchExecution");

  useEffect(() => {
    if (!isOpen) {
      setCsv(undefined);
      setZip(undefined);
      setSummary(undefined);
      setCsvError(undefined);
      setZipError(undefined);
      setSubmitError(undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!csv) return setSummary(undefined);
    if (!isCsvFile(csv)) {
      setSummary(undefined);
      setCsvError("Choose a .csv file with a header row.");
      return undefined;
    }
    let live = true;
    setSummary(undefined);
    setCsvError(undefined);
    csv
      .text()
      .then((t) => live && setSummary({ file: csv, csv: summarizeCsv(t) }))
      .catch(() => live && setCsvError("The file could not be read."));
    return () => {
      live = false;
    };
  }, [csv]);

  useEffect(() => {
    if (summary) setCsvError(validateCatalog(summary.csv, !!zip));
  }, [summary, zip]);

  useEffect(() => {
    setZipError(
      zip && !isZipFile(zip)
        ? "Choose a .zip file with the product images."
        : undefined,
    );
  }, [zip]);

  const ready = !!csv && summary?.file === csv && !csvError && !zipError;

  const start = async () => {
    if (!csv || !ready) return;
    setBusy(true);
    setSubmitError(undefined);
    try {
      const [inputFile, compressedImagesFile] = await Promise.all([
        uploadFile(fetchClient, csv, csv.name, "text/csv"),
        zip
          ? uploadFile(fetchClient, zip, zip.name, "application/zip")
          : Promise.resolve(undefined),
      ]);
      const res = await create.mutateAsync({
        body: { inputFile, compressedImagesFile },
      });
      onStarted(res.executionId);
      onOpenChange(false);
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : errorMessage(e, "The batch could not be started."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalPanel
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Start a batch"
      eyebrow="New batch"
      isDismissable={!busy}
    >
      <FilePicker
        label="Product catalog"
        required
        file={csv}
        accept={[".csv", "text/csv"]}
        ok={ready || (!!summary && !csvError)}
        hint="A CSV with a header row: 'title' and 'description', or 'images'."
        error={csvError}
        summary={
          summary &&
          summary.file === csv && (
            <>
              <span className="text-muted text-[12.5px]">
                {summary.csv.rows}{" "}
                {summary.csv.rows === 1 ? "product" : "products"} ·{" "}
                {summary.csv.columns.length} columns
              </span>
              <span className="flex flex-wrap gap-1.5" aria-label="Columns">
                {summary.csv.columns.map((c) => (
                  <span
                    key={c}
                    className="bg-surface border-line-2 rounded border px-1.5 font-mono text-[12px]"
                  >
                    {c}
                  </span>
                ))}
              </span>
            </>
          )
        }
        onFile={setCsv}
      />
      <FilePicker
        label="Product images"
        file={zip}
        accept={[".zip", "application/zip"]}
        ok={!zipError}
        hint={
          <>
            A ZIP file. Image file names must match the{" "}
            <span className="font-mono">images</span> column.
          </>
        }
        error={zipError}
        summary={
          zip && (
            <span className="text-muted text-[12.5px]">
              {(zip.size / 1024 / 1024).toFixed(1)} MB
            </span>
          )
        }
        onFile={setZip}
      />
      <Section title="CSV format">
        <div className="text-muted grid gap-2 text-[13px]">
          <p>
            Each row is one product. Use{" "}
            <code className="font-mono">title</code> and{" "}
            <code className="font-mono">description</code> to categorize
            existing listings, or <code className="font-mono">images</code> to
            generate them, for example{" "}
            <code className="font-mono">{"\"['front.jpg','side.jpg']\""}</code>.
          </p>
          <p>
            Optional columns:{" "}
            <code className="font-mono">short_description</code> and{" "}
            <code className="font-mono">metadata</code>. Other columns are
            ignored. Images: JPEG, PNG, WebP or GIF, up to 20 per product.
          </p>
        </div>
      </Section>
      <p className="text-muted text-[13px]">
        Need a starting point?{" "}
        <button
          type="button"
          className="text-accent font-semibold underline-offset-2 hover:underline"
          onClick={() =>
            downloadBlob(
              new Blob([SAMPLE_CSV], { type: "text/csv" }),
              "sample-catalog.csv",
            )
          }
        >
          Download a sample CSV
        </button>
      </p>
      {submitError && (
        <ErrorAlert
          title="The batch could not be started"
          detail={submitError}
          onRetry={() => void start()}
        />
      )}
      <div className="flex justify-end gap-2">
        <Button onPress={() => onOpenChange(false)} isDisabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onPress={() => void start()}
          isDisabled={!ready}
          isPending={busy}
        >
          Start batch
        </Button>
      </div>
    </ModalPanel>
  );
};
