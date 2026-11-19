/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { readAndCompressImage } from "browser-image-resizer";

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
export const MAX_IMAGES = 20;

/** Scales an image down to 1024 px on the long side before upload, as the previous website did. */
export const resizeForUpload = (file: File): Promise<Blob> =>
  readAndCompressImage(file, {
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.7,
    mimeType: file.type,
  });

/** A small JPEG data URL used for the gallery and saved with the draft. */
export async function makePreview(file: Blob, maxSize = 640): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  // A very long, thin image would round its short side to 0 px and give an empty picture.
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.78);
}

/**
 * Rebuilds a File from a data URL, for images saved in a draft before they were uploaded.
 * Returns undefined when the data URL holds no usable image, so a damaged draft still opens.
 */
export function dataUrlToFile(dataUrl: string, name: string): File | undefined {
  try {
    const [head, body] = dataUrl.split(",");
    if (!body) return undefined;
    const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
    const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
    return new File([bytes], name.replace(/\.[^.]+$/, "") + ".jpg", { type });
  } catch {
    return undefined;
  }
}

/** Saves a Blob as a file download. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
