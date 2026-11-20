/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useSyncExternalStore } from "react";
import { writeJson } from "./storage";
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
  /** The listing text the attributes were extracted for. Missing in older drafts: same as classifiedFor. */
  extractedFor?: string;
  /** The metadata and image keys, in order, that the listing was generated from. */
  generatedFrom?: GenerationInputs;
  /** The language and length the listing was generated with. Missing in older drafts: the current options. */
  generatedWith?: Pick<GenerationOptions, "language" | "descriptionLength">;
}

export interface GenerationInputs {
  metadata: string;
  imageKeys: string[];
}

export const draftTitle = (d: Draft) =>
  d.product?.title?.trim() || "Untitled product";

/**
 * Drafts are kept per signed-in account, so another account in the same browser doesn't see them.
 * The owner is the account's unique ID, not its user name: a deleted account's name can be reused.
 */
let owner = "";
let cache: Draft[] | undefined;
/** The stored text `cache` was parsed from, to tell when another tab changed it. */
let cachedRaw: string | null | undefined;
const storageKey = () => `${DRAFTS_KEY}:${owner}`;

/**
 * Sets the account whose drafts are listed. Drafts saved before they were keyed by account ID sit
 * under the user name: the first sign-in of that user name moves them, once, when the account has none.
 */
export function setDraftsOwner(accountId: string, legacyUsername?: string) {
  if (owner === accountId) return;
  owner = accountId;
  cache = undefined;
  if (accountId && legacyUsername && legacyUsername !== accountId) {
    try {
      const old = `${DRAFTS_KEY}:${legacyUsername}`;
      const text = localStorage.getItem(old);
      if (text !== null && localStorage.getItem(storageKey()) === null) {
        localStorage.setItem(storageKey(), text);
        localStorage.removeItem(old);
      }
    } catch {
      // Storage is unavailable or full: start with no drafts.
    }
  }
  // Called while rendering, so notify subscribers afterwards.
  queueMicrotask(() => window.dispatchEvent(new Event(CHANGED)));
}

const NONE: Draft[] = [];

function load(): Draft[] {
  let text: string | null = null;
  let raw: unknown = [];
  try {
    text = localStorage.getItem(storageKey());
    if (text !== null) raw = JSON.parse(text);
  } catch {
    // Unreadable storage or damaged data: no drafts.
  }
  cachedRaw = text;
  cache = (Array.isArray(raw) ? (raw as Draft[]) : []).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  return cache;
}

export function listDrafts(): Draft[] {
  if (!owner) return NONE;
  return cache ?? load();
}

/**
 * Like listDrafts, but first checks storage for changes made in another tab whose notification has not
 * arrived yet. Used before writing, so a write never brings back what another tab just removed.
 */
function listFresh(): Draft[] {
  if (!owner) return NONE;
  try {
    if (cache && localStorage.getItem(storageKey()) === cachedRaw) return cache;
  } catch {
    return cache ?? load();
  }
  return load();
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
      // An image that was never uploaded can only be restored from its preview: drop it with the preview.
      list = [
        {
          ...list[0],
          images: list[0].images
            .filter((i) => i.key)
            .map((i) => ({ ...i, dataUrl: "" })),
        },
      ];
    } else break;
    ok = writeJson(storageKey(), list);
  }
  if (ok) {
    cache = list;
    // The text this tab wrote, not a second read that could already hold another tab's write.
    cachedRaw = JSON.stringify(list);
  } else cache = undefined;
  window.dispatchEvent(new Event(CHANGED));
  return ok;
}

export const getDraft = (id: string) => listDrafts().find((d) => d.id === id);

/** True when the draft is still stored. Reads storage again, so it sees a clear done in another tab. */
export const draftExists = (id: string) => listFresh().some((d) => d.id === id);

/** Saves a draft. Returns false when the browser could not store it. */
export function saveDraft(draft: Draft): boolean {
  return (
    commit([draft, ...listFresh().filter((d) => d.id !== draft.id)]) &&
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
