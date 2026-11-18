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
/** Event that asks open editors to save their pending draft now, for example before signing out. */
export const FLUSH_DRAFTS = "spo:flush-drafts";

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
  /** Empty means the model configured for the deployment. */
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
  /** The listing text the category and attributes were computed for. */
  classifiedFor?: string;
}

export const draftTitle = (d: Draft) =>
  d.product?.title?.trim() || "Untitled product";

/** Drafts are kept per signed-in user, so another account in the same browser doesn't see them. */
let owner = "";
let cache: Draft[] | undefined;
const storageKey = () => `${DRAFTS_KEY}:${owner}`;

export function setDraftsOwner(username: string) {
  if (owner === username) return;
  owner = username;
  cache = undefined;
  // Called while rendering, so notify subscribers afterwards.
  queueMicrotask(() => window.dispatchEvent(new Event(CHANGED)));
}

const NONE: Draft[] = [];

export function listDrafts(): Draft[] {
  if (!owner) return NONE;
  if (!cache) {
    const raw = readJson<unknown>(storageKey(), []);
    cache = (Array.isArray(raw) ? (raw as Draft[]) : []).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
  }
  return cache;
}

/** Writes the list. Returns false when nothing could be stored. */
function commit(drafts: Draft[]): boolean {
  if (!owner) return false;
  // localStorage can run out of space: drop the oldest drafts, then images, until it fits.
  let list = [...drafts]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_DRAFTS);
  let ok = writeJson(storageKey(), list);
  while (!ok && list.length) {
    if (list.length > 1) list = list.slice(0, -1);
    else if (list[0].images.some((i) => i.dataUrl)) {
      list = [
        {
          ...list[0],
          images: list[0].images.map((i) => ({ ...i, dataUrl: "" })),
        },
      ];
    } else break;
    ok = writeJson(storageKey(), list);
  }
  cache = ok ? list : undefined;
  window.dispatchEvent(new Event(CHANGED));
  return ok;
}

export const getDraft = (id: string) => listDrafts().find((d) => d.id === id);

/** Saves a draft. Returns false when the browser could not store it. */
export function saveDraft(draft: Draft): boolean {
  return (
    commit([draft, ...listDrafts().filter((d) => d.id !== draft.id)]) &&
    !!getDraft(draft.id)
  );
}

/** Returns false when the browser refused the change. */
export function clearDrafts(): boolean {
  return commit([]);
}

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === storageKey()) {
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
