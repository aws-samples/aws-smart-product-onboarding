/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_OPTIONS, MAX_LANGUAGE_LENGTH } from "./models";
import {
  errorMessage,
  modelRetry,
  uploadFile,
  useApi,
  type Classification,
  type DescriptionLength,
  type GenerationModel,
  type ProductAttribute,
  type ProductData,
} from "../../api/client";
import {
  draftExists,
  FLUSH_DRAFTS,
  getDraft,
  saveDraft,
  setActiveDraftId,
  type Draft,
  type GenerationInputs,
  type GenerationOptions,
} from "../../lib/drafts";
import {
  ACCEPTED_IMAGE_TYPES,
  dataUrlToFile,
  MAX_IMAGES,
  makePreview,
  resizeForUpload,
} from "../../lib/images";

export interface FlowImage {
  id: string;
  name: string;
  type: string;
  /** What the gallery shows: an object URL for new files, or the saved preview. Empty when no preview was kept. */
  url: string;
  /** Downscaled preview saved with the draft. */
  dataUrl?: string;
  file?: File;
  /** S3 object key once uploaded. */
  key?: string;
}

export type GenStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "generating"
  | "done"
  | "error";
export type StageStatus = "idle" | "running" | "done" | "error";
export interface Stages {
  metaclass: StageStatus;
  categorize: StageStatus;
  attributes: StageStatus;
}

export const STEPS = [
  "Images & details",
  "Generate",
  "Category & attributes",
  "Review",
] as const;

const IDLE: Stages = {
  metaclass: "idle",
  categorize: "idle",
  attributes: "idle",
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/**
 * Restores images. Images that were never uploaded are rebuilt from their saved JPEG preview.
 * A preview that cannot be decoded is dropped, so the image shows as not saved and the draft still opens.
 */
const fromDraft = (d?: Draft): FlowImage[] =>
  (d?.images ?? []).map((i) => {
    const file =
      !i.key && i.dataUrl ? dataUrlToFile(i.dataUrl, i.name) : undefined;
    const dataUrl = i.key || file ? i.dataUrl : "";
    return {
      id: i.id,
      name: file?.name ?? i.name,
      type: file?.type ?? i.type,
      url: dataUrl,
      dataUrl,
      key: i.key,
      file,
    };
  });

/** What the category and attributes depend on: the listing text and metadata. */
const classificationInputs = (p: ProductData | undefined, metadata: string) =>
  p ? JSON.stringify([p.title, p.description, metadata.trim()]) : "";

/** The metadata and ordered image keys a generation uses. A new, not yet uploaded image has no key. */
const generationInputs = (
  images: FlowImage[],
  metadata: string,
): GenerationInputs => ({
  metadata: metadata.trim(),
  imageKeys: images.map((i) => i.key ?? `new:${i.id}`),
});
const sameInputs = (a: GenerationInputs, b: GenerationInputs) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * State and actions for onboarding one product: images and details, listing
 * generation, categorization and attribute extraction. With `persist`, the
 * product is saved as a draft in localStorage once a listing exists.
 */
export function useProductFlow({
  draftId,
  persist,
  onSaveFailed,
}: {
  draftId?: string;
  persist: boolean;
  onSaveFailed?: () => void;
}) {
  const { $api, fetchClient } = useApi();
  const initial = useRef(draftId ? getDraft(draftId) : undefined).current;

  const [id] = useState(() => initial?.id ?? newId());
  const [step, setStep] = useState(initial?.step ?? 0);
  const [images, setImages] = useState<FlowImage[]>(() => fromDraft(initial));
  const [metadata, setMetadata] = useState(initial?.metadata ?? "");
  const [options, setOptions] = useState<GenerationOptions>(
    initial?.options ?? DEFAULT_OPTIONS,
  );
  const [examples, setExamples] = useState<ProductData[]>(
    initial?.examples ?? [],
  );
  const [product, setProduct] = useState<ProductData | undefined>(
    initial?.product,
  );
  const [usage, setUsage] = useState(initial?.usage);
  const [modelId, setModelId] = useState(initial?.modelId);
  const [possibleCategories, setPossibleCategories] = useState(
    initial?.possibleCategories,
  );
  const [classification, setClassification] = useState<
    Classification | undefined
  >(initial?.classification);
  const [attributes, setAttributes] = useState<ProductAttribute[] | undefined>(
    initial?.attributes,
  );
  const [classifiedFor, setClassifiedFor] = useState(initial?.classifiedFor);
  const [extractedFor, setExtractedFor] = useState(
    initial?.extractedFor ?? initial?.classifiedFor,
  );
  // Drafts saved before this was recorded: take the inputs they were opened with.
  const [generatedFrom, setGeneratedFrom] = useState<
    GenerationInputs | undefined
  >(
    () =>
      initial?.generatedFrom ??
      (initial?.product
        ? generationInputs(fromDraft(initial), initial.metadata)
        : undefined),
  );

  const [generatedWith, setGeneratedWith] = useState(initial?.generatedWith);

  const [genStatus, setGenStatus] = useState<GenStatus>(
    initial?.product ? "done" : "idle",
  );
  const [genError, setGenError] = useState<string>();
  const [stages, setStages] = useState<Stages>({
    metaclass: initial?.possibleCategories ? "done" : "idle",
    categorize: initial?.classification ? "done" : "idle",
    attributes: initial?.attributes ? "done" : "idle",
  });
  const [classifyError, setClassifyError] = useState<string>();

  const generateM = $api.useMutation("post", "/generateProduct");
  const metaclassM = $api.useMutation("post", "/metaclass", modelRetry);
  const categorizeM = $api.useMutation(
    "post",
    "/categorizeProduct",
    modelRetry,
  );
  const extractM = $api.useMutation("post", "/extractAttributes", modelRetry);

  /** Each run gets a number; a response from an older run is discarded. */
  const run = useRef(0);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      run.current++;
    };
  }, []);

  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(
    () => () =>
      imagesRef.current.forEach(
        (i) => i.url.startsWith("blob:") && URL.revokeObjectURL(i.url),
      ),
    [],
  );

  // Draft persistence: debounce saves, but flush on unmount and page exit so edits are not lost.
  const savedOnce = useRef(!!initial);
  const deleted = useRef(false);
  const pending = useRef<Draft>();
  const flush = useCallback(
    (updateAddress = true) => {
      const draft = pending.current;
      pending.current = undefined;
      if (!draft || deleted.current) return;
      if (savedOnce.current && !draftExists(draft.id)) {
        // The draft was cleared from Recent drafts: stop saving it again.
        deleted.current = true;
        return;
      }
      if (!saveDraft(draft)) {
        onSaveFailed?.();
        return;
      }
      if (!savedOnce.current) {
        savedOnce.current = true;
        // Keep the router state; only the address changes so a reload reopens this draft.
        // Not on unmount: the user may already be on another page, such as a new product.
        // The address can also be a draft that no longer exists: it now names this one.
        const path = window.location.pathname;
        if (
          updateAddress &&
          live.current &&
          (path === "/new" || (draftId && path === `/drafts/${draftId}`))
        ) {
          window.history.replaceState(
            window.history.state,
            "",
            `/drafts/${draft.id}`,
          );
        }
      }
      setActiveDraftId(draft.id);
    },
    [onSaveFailed, draftId],
  );

  // The values an opened draft was loaded with. Until one changes there is nothing to save, so
  // opening a draft does not touch its saved time or overwrite an edit saved in the meantime.
  const loaded = useRef<unknown[]>();
  useEffect(() => {
    if (!persist || !product || deleted.current) return undefined;
    const values = [
      step,
      images,
      metadata,
      options,
      examples,
      product,
      usage,
      modelId,
      possibleCategories,
      classification,
      attributes,
      classifiedFor,
      extractedFor,
      generatedFrom,
      generatedWith,
    ];
    loaded.current ??= initial ? values : [];
    if (values.every((v, n) => Object.is(v, loaded.current![n]))) return;
    pending.current = {
      id,
      updatedAt: Date.now(),
      step,
      images: images.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        dataUrl: i.dataUrl ?? "",
        key: i.key,
      })),
      metadata,
      options,
      examples,
      product,
      usage,
      modelId,
      possibleCategories,
      classification,
      attributes,
      classifiedFor,
      extractedFor,
      generatedFrom,
      generatedWith,
    };
    const t = setTimeout(() => flush(), 300);
    return () => clearTimeout(t);
  }, [
    persist,
    initial,
    id,
    step,
    images,
    metadata,
    options,
    examples,
    product,
    usage,
    modelId,
    possibleCategories,
    classification,
    attributes,
    classifiedFor,
    extractedFor,
    generatedFrom,
    generatedWith,
    flush,
  ]);

  useEffect(() => {
    const now = () => flush();
    window.addEventListener("pagehide", now);
    // Sent before signing out, while the draft still has an owner.
    window.addEventListener(FLUSH_DRAFTS, now);
    return () => {
      window.removeEventListener("pagehide", now);
      window.removeEventListener(FLUSH_DRAFTS, now);
      flush(false);
    };
  }, [flush]);

  useEffect(() => {
    if (persist && initial) setActiveDraftId(id);
    return () => setActiveDraftId(undefined);
  }, [persist, initial, id]);

  /** Adds image files. Returns how many were added and a message for files that were skipped. */
  const addImages = useCallback(
    (files: File[]): { added: number; message?: string } => {
      const accepted = files.filter((f) =>
        ACCEPTED_IMAGE_TYPES.includes(f.type),
      );
      const room = MAX_IMAGES - imagesRef.current.length;
      const added = accepted.slice(0, Math.max(0, room)).map(
        (file): FlowImage => ({
          id: newId(),
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file),
          file,
        }),
      );
      imagesRef.current = [...imagesRef.current, ...added];
      setImages((all) => [...all, ...added]);
      added.forEach((img) => {
        if (!img.file) return;
        makePreview(img.file)
          .then((dataUrl) =>
            setImages((all) =>
              all.map((i) => (i.id === img.id ? { ...i, dataUrl } : i)),
            ),
          )
          .catch(() => undefined);
      });
      const skippedType = files.length - accepted.length;
      const skippedRoom = accepted.length - added.length;
      let message: string | undefined;
      if (skippedType)
        message = `${skippedType} file(s) skipped: use JPEG, PNG, WebP or GIF images.`;
      else if (skippedRoom)
        message = `Up to ${MAX_IMAGES} images per product. ${skippedRoom} file(s) skipped.`;
      return { added: added.length, message };
    },
    [],
  );

  const removeImage = (imageId: string) =>
    setImages((all) => {
      const img = all.find((i) => i.id === imageId);
      if (img?.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
      return all.filter((i) => i.id !== imageId);
    });

  const moveImage = (imageId: string, by: -1 | 1) =>
    setImages((all) => {
      const from = all.findIndex((i) => i.id === imageId);
      const to = from + by;
      if (from < 0 || to < 0 || to >= all.length) return all;
      const next = [...all];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

  const languageError =
    options.language.length > MAX_LANGUAGE_LENGTH
      ? `Use ${MAX_LANGUAGE_LENGTH} characters or fewer.`
      : undefined;
  const canGenerate =
    (images.length > 0 || metadata.trim().length > 0) && !languageError;
  const generating = ["preparing", "uploading", "generating"].includes(
    genStatus,
  );
  const classifying = Object.values(stages).includes("running");

  const clearClassification = () => {
    setPossibleCategories(undefined);
    setClassification(undefined);
    setAttributes(undefined);
    setClassifiedFor(undefined);
    setExtractedFor(undefined);
    setStages(IDLE);
    setClassifyError(undefined);
  };

  const generate = useCallback(async () => {
    // Not while categorizing: the listing it is categorizing would change underneath it.
    if (!canGenerate || generating || classifying) return;
    const token = ++run.current;
    const current = () => live.current && token === run.current;
    setGenError(undefined);
    try {
      const lost = images.filter((i) => !i.key && !i.file).length;
      if (lost) {
        throw new Error(
          `${lost} image(s) in this draft were never uploaded and their previews were not saved. Remove them and add them again.`,
        );
      }
      const pendingImages = images.filter((i) => !i.key && i.file);
      let keyed = images;
      if (pendingImages.length) {
        setGenStatus("preparing");
        const blobs = await Promise.all(
          pendingImages.map((i) => resizeForUpload(i.file!)),
        );
        if (!current()) return;
        setGenStatus("uploading");
        const keys = await Promise.all(
          pendingImages.map((img, n) =>
            uploadFile(fetchClient, blobs[n], img.name, img.type),
          ),
        );
        if (!current()) return;
        const byId = new Map(pendingImages.map((img, n) => [img.id, keys[n]]));
        keyed = images.map((i) =>
          byId.has(i.id) ? { ...i, key: byId.get(i.id) } : i,
        );
        setImages((all) =>
          all.map((i) => (byId.has(i.id) ? { ...i, key: byId.get(i.id) } : i)),
        );
      }
      setGenStatus("generating");
      const result = await generateM.mutateAsync({
        body: {
          productImages: keyed
            .map((i) => i.key)
            .filter((k): k is string => !!k),
          metadata: metadata.trim() || undefined,
          language: options.language.trim() || undefined,
          descriptionLength: options.descriptionLength as DescriptionLength,
          // Leave the model out so the API uses the one configured for the deployment.
          model: (options.model || undefined) as GenerationModel | undefined,
          temperature: options.temperature,
          examples: examples.filter(
            (e) => e.title.trim() || e.description.trim(),
          ),
        },
      });
      if (!current()) return;
      setProduct(result.product);
      setGeneratedFrom(generationInputs(keyed, metadata));
      setGeneratedWith({
        language: options.language,
        descriptionLength: options.descriptionLength,
      });
      setUsage(result.usage);
      setModelId(options.model || undefined);
      // New listing text: the old category and attributes no longer describe it.
      clearClassification();
      setGenStatus("done");
    } catch (e) {
      if (!current()) return;
      setGenError(
        e instanceof Error
          ? e.message
          : errorMessage(e, "The listing could not be generated."),
      );
      setGenStatus("error");
    }
  }, [
    canGenerate,
    generating,
    classifying,
    images,
    fetchClient,
    generateM,
    metadata,
    options,
    examples,
  ]);

  const extractFor = useCallback(
    async (token: number, input: ProductData, categoryId: string) => {
      const current = () => live.current && token === run.current;
      setStages((s) => ({ ...s, attributes: "running" }));
      try {
        const res = await extractM.mutateAsync({
          body: {
            product: { ...input, metadata: metadata.trim() || undefined },
            categoryId,
          },
        });
        if (!current()) return;
        setAttributes(res.attributes);
        setStages((s) => ({ ...s, attributes: "done" }));
      } catch (e) {
        if (!current()) return;
        setClassifyError(errorMessage(e, "Attributes could not be extracted."));
        setStages((s) => ({ ...s, attributes: "error" }));
      }
    },
    [metadata, extractM],
  );

  /** Categorizing needs a title and a description. */
  const canClassify =
    !!product?.title?.trim() && !!product?.description?.trim();
  const currentInputs = classificationInputs(product, metadata);
  /** The listing was edited after it was categorized. */
  const categoryStale =
    !!classification &&
    classifiedFor !== undefined &&
    classifiedFor !== currentInputs;

  /** Re-extracts attributes for the current category. Not while the category is out of date. */
  const extract = useCallback(async () => {
    if (
      !product ||
      !classification ||
      !canClassify ||
      categoryStale ||
      classifying ||
      generating
    )
      return;
    const token = ++run.current;
    setClassifyError(undefined);
    setAttributes(undefined);
    setExtractedFor(classificationInputs(product, metadata));
    await extractFor(token, product, classification.categoryId);
  }, [
    product,
    classification,
    canClassify,
    categoryStale,
    classifying,
    generating,
    metadata,
    extractFor,
  ]);

  /** Metaclass, then categorization, then attribute extraction, for the listing as it is now. */
  const classify = useCallback(async () => {
    if (!product || !canClassify || classifying || generating) return;
    const token = ++run.current;
    const current = () => live.current && token === run.current;
    const input = product;
    const inputs = classificationInputs(input, metadata);
    setClassifyError(undefined);
    setPossibleCategories(undefined);
    setClassification(undefined);
    setAttributes(undefined);
    setClassifiedFor(inputs);
    setExtractedFor(inputs);
    setStages({ metaclass: "running", categorize: "idle", attributes: "idle" });
    let categories: string[];
    try {
      const meta = await metaclassM.mutateAsync({ body: { product: input } });
      if (!current()) return;
      categories = meta.possibleCategories;
      setPossibleCategories(categories);
      setStages((s) => ({ ...s, metaclass: "done", categorize: "running" }));
    } catch (e) {
      if (!current()) return;
      setClassifyError(
        errorMessage(e, "Candidate categories could not be found."),
      );
      setStages((s) => ({ ...s, metaclass: "error" }));
      return;
    }
    try {
      const cat = await categorizeM.mutateAsync({
        body: { product: input, possibleCategories: categories, demo: true },
      });
      if (!current()) return;
      setClassification(cat);
      setStages((s) => ({ ...s, categorize: "done" }));
      await extractFor(token, input, cat.categoryId);
    } catch (e) {
      if (!current()) return;
      setClassifyError(
        errorMessage(e, "The product could not be categorized."),
      );
      setStages((s) => ({ ...s, categorize: "error" }));
    }
  }, [
    product,
    canClassify,
    classifying,
    generating,
    metadata,
    metaclassM,
    categorizeM,
    extractFor,
  ]);

  /** Re-runs whichever stage failed last. */
  const retryClassification = () =>
    stages.attributes === "error" && classification && !categoryStale
      ? extract()
      : classify();

  const updateProduct = (patch: Partial<ProductData>) =>
    setProduct((p) => (p ? { ...p, ...patch } : p));

  /** True when the listing was edited after the category or the attributes were computed. */
  const classificationStale =
    categoryStale ||
    (!!attributes &&
      extractedFor !== undefined &&
      extractedFor !== currentInputs);
  /** True when the images or metadata changed after the listing was generated. */
  const generationStale =
    !!product &&
    !!generatedFrom &&
    !sameInputs(generatedFrom, generationInputs(images, metadata));
  const classified =
    stages.attributes === "done" && !!classification && !!attributes;

  return {
    id,
    step,
    setStep,
    images,
    addImages,
    removeImage,
    moveImage,
    metadata,
    setMetadata,
    options,
    setOptions,
    /** The language and length the current listing was written with. */
    generatedWith: generatedWith ?? options,
    languageError,
    examples,
    setExamples,
    product,
    updateProduct,
    usage,
    modelId,
    possibleCategories,
    classification,
    attributes,
    classificationStale,
    categoryStale,
    generationStale,
    canClassify,
    classified,
    genStatus,
    genError,
    generating,
    canGenerate,
    generate,
    stages,
    classifying,
    classifyError,
    classify,
    extract,
    retryClassification,
  };
}

export type ProductFlow = ReturnType<typeof useProductFlow>;
