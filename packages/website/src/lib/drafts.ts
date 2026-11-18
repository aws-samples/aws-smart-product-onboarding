/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "./storage";
import type {
  Classification,
  ProductAttribute,
  ProductData,
} from "../api/client";

export const DRAFTS_KEY = "spo:drafts";
export const MAX_DRAFTS = 8;
const CHANGED = "spo:drafts-changed";

export interface StoredImage {
  id: string;
  name: string;
  type: string;
  /** A downscaled JPEG data URL, so the draft can be shown again after a reload. */
  dataUrl: string;
  /** The S3 object key from the first upload, reused when regenerating. */
  key?: string;
}

export interface GenerationOptions {
  language: string;
  descriptionLength: "short" | "medium" | "long";
  model: string;
  temperature: number;
}

export interface Draft {
  id: string;
  updatedAt: number;
  step: number;
  images: StoredImage[];
  metadata: string;
  options: GenerationOptions;
  examples: ProductData[];
  product?: ProductData;
  usage?: { inputTokens: number; outputTokens?: number };
  modelId?: string;
  possibleCategories?: string[];
  classification?: Classification;
  attributes?: ProductAttribute[];
}

export const draftTitle = (d: Draft) =>
  d.product?.title?.trim() || "Untitled product";

let cache: Draft[] | undefined;

export function listDrafts(): Draft[] {
  if (!cache) {
    const raw = readJson<unknown>(DRAFTS_KEY, []);
    cache = (Array.isArray(raw) ? (raw as Draft[]) : []).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }
  return cache;
}

function commit(drafts: Draft[]) {
  // localStorage can run out of space: drop the oldest drafts, then images, until it fits.
  let list = [...drafts]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_DRAFTS);
  while (!writeJson(DRAFTS_KEY, list)) {
    if (list.length > 1) list = list.slice(0, -1);
    else if (list[0]?.images.some((i) => i.dataUrl)) {
      list = [
        {
          ...list[0],
          images: list[0].images.map((i) => ({ ...i, dataUrl: "" })),
        },
      ];
    } else break;
  }
  cache = list;
  window.dispatchEvent(new Event(CHANGED));
}

export const getDraft = (id: string) => listDrafts().find((d) => d.id === id);

export function saveDraft(draft: Draft) {
  commit([draft, ...listDrafts().filter((d) => d.id !== draft.id)]);
}

export function clearDrafts() {
  commit([]);
}

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === DRAFTS_KEY) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const useDrafts = () => useSyncExternalStore(subscribe, listDrafts);

let activeId: string | undefined;
const ACTIVE = "spo:active-draft";

/** The draft open in the product editor, highlighted in the rail. */
export function setActiveDraftId(id: string | undefined) {
  if (activeId === id) return;
  activeId = id;
  window.dispatchEvent(new Event(ACTIVE));
}

export const useActiveDraftId = () =>
  useSyncExternalStore(
    (l) => {
      window.addEventListener(ACTIVE, l);
      return () => window.removeEventListener(ACTIVE, l);
    },
    () => activeId,
  );

/** Test hook: forget the in-memory copy so the next read goes to localStorage. */
export const resetDraftCache = () => {
  cache = undefined;
};
