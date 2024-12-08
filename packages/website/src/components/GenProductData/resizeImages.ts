/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { readAndCompressImage } from "browser-image-resizer";

export const imageResizeConfig = {
  maxWidth: 1024,
  maxHeight: 1024,
  quality: 0.7,
};

export async function resizeImage(file: File) {
  const image = await readAndCompressImage(file, {
    ...imageResizeConfig,
    mimeType: file.type,
  });
  return image;
}

export interface ProductImage {
  data: Blob;
  type: string;
  name: string;
}

export async function prepareImages(files: File[]): Promise<ProductImage[]> {
  const resizedImages = await Promise.all(
    files.map(async (file): Promise<ProductImage> => {
      return {
        data: await resizeImage(file),
        type: file.type,
        name: file.name,
      };
    }),
  );
  return resizedImages;
}
