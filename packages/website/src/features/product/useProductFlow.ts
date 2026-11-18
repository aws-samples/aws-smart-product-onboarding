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
  getDraft,
  saveDraft,
  setActiveDraftId,
  type Draft,
  type GenerationOptions,
} from "../../lib/drafts";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGES,
  makePreview,
  resizeForUpload,
} from "../../lib/images";

export interface FlowImage {
  id: string;
  name: string;
  type: string;
  /** What the gallery shows: an object URL for new files, or the saved preview. */
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

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const fromDraft = (d?: Draft): FlowImage[] =>
  (d?.images ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    url: i.dataUrl,
    dataUrl: i.dataUrl,
    key: i.key,
  }));

/**
 * State and actions for onboarding one product: images and details, listing
 * generation, categorization and attribute extraction. With `persist`, the
 * product is saved as a draft in localStorage once a listing exists.
 */
export function useProductFlow({
  draftId,
  persist,
}: {
  draftId?: string;
  persist: boolean;
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

  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(
    () => () =>
      imagesRef.current.forEach(
        (i) => i.url.startsWith("blob:") && URL.revokeObjectURL(i.url),
      ),
    [],
  );

  // Save the draft once there is a listing to come back to.
  const savedOnce = useRef(!!initial);
  useEffect(() => {
    if (!persist || !product) return;
    const t = setTimeout(() => {
      saveDraft({
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
      });
      if (!savedOnce.current) {
        savedOnce.current = true;
        // Keep the router state; only the address changes so a reload reopens this draft.
        window.history.replaceState(window.history.state, "", `/drafts/${id}`);
      }
      setActiveDraftId(id);
    }, 300);
    return () => clearTimeout(t);
  }, [
    persist,
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
  ]);

  useEffect(() => {
    if (persist && initial) setActiveDraftId(id);
    return () => setActiveDraftId(undefined);
  }, [persist, initial, id]);

  /** Adds image files. Returns a message for files that were skipped. */
  const addImages = useCallback((files: File[]): string | undefined => {
    const accepted = files.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
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
    if (skippedType)
      return `${skippedType} file(s) skipped: use JPEG, PNG, WebP or GIF images.`;
    if (skippedRoom)
      return `Up to ${MAX_IMAGES} images per product. ${skippedRoom} file(s) skipped.`;
    return undefined;
  }, []);

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

  const generate = useCallback(async () => {
    if (!canGenerate || generating) return;
    setGenError(undefined);
    try {
      const pending = images.filter((i) => !i.key && i.file);
      let keyed = images;
      if (pending.length) {
        setGenStatus("preparing");
        const blobs = await Promise.all(
          pending.map((i) => resizeForUpload(i.file!)),
        );
        setGenStatus("uploading");
        const keys = await Promise.all(
          pending.map((img, n) =>
            uploadFile(fetchClient, blobs[n], img.name, img.type),
          ),
        );
        const byId = new Map(pending.map((img, n) => [img.id, keys[n]]));
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
          model: options.model as GenerationModel,
          temperature: options.temperature,
          examples: examples.filter(
            (e) => e.title.trim() || e.description.trim(),
          ),
        },
      });
      setProduct(result.product);
      setUsage(result.usage);
      setModelId(options.model);
      setGenStatus("done");
    } catch (e) {
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
    images,
    fetchClient,
    generateM,
    metadata,
    options,
    examples,
  ]);

  const extract = useCallback(
    async (categoryId?: string) => {
      const id_ = categoryId ?? classification?.categoryId;
      if (!product || !id_) return;
      setClassifyError(undefined);
      setStages((s) => ({ ...s, attributes: "running" }));
      try {
        const res = await extractM.mutateAsync({
          body: {
            product: { ...product, metadata: metadata.trim() || undefined },
            categoryId: id_,
          },
        });
        setAttributes(res.attributes);
        setStages((s) => ({ ...s, attributes: "done" }));
      } catch (e) {
        setClassifyError(errorMessage(e, "Attributes could not be extracted."));
        setStages((s) => ({ ...s, attributes: "error" }));
      }
    },
    [product, classification, metadata, extractM],
  );

  /** Metaclass, then categorization, then attribute extraction. */
  const classify = useCallback(async () => {
    if (!product) return;
    setClassifyError(undefined);
    setStages({ metaclass: "running", categorize: "idle", attributes: "idle" });
    let categories: string[];
    try {
      const meta = await metaclassM.mutateAsync({ body: { product } });
      categories = meta.possibleCategories;
      setPossibleCategories(categories);
      setStages((s) => ({ ...s, metaclass: "done", categorize: "running" }));
    } catch (e) {
      setClassifyError(
        errorMessage(e, "Candidate categories could not be found."),
      );
      setStages((s) => ({ ...s, metaclass: "error" }));
      return;
    }
    try {
      const cat = await categorizeM.mutateAsync({
        body: { product, possibleCategories: categories, demo: true },
      });
      setClassification(cat);
      setAttributes(undefined);
      setStages((s) => ({ ...s, categorize: "done" }));
      await extract(cat.categoryId);
    } catch (e) {
      setClassifyError(
        errorMessage(e, "The product could not be categorized."),
      );
      setStages((s) => ({ ...s, categorize: "error" }));
    }
  }, [product, metaclassM, categorizeM, extract]);

  const classifying = Object.values(stages).includes("running");

  /** Re-runs whichever stage failed last. */
  const retryClassification = () =>
    stages.attributes === "error" ? extract() : classify();

  const updateProduct = (patch: Partial<ProductData>) =>
    setProduct((p) => (p ? { ...p, ...patch } : p));

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
