/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { useState } from "react";
import {
  Button as AriaButton,
  DropZone,
  FileTrigger,
  Text,
  type DropItem,
  type FileDropItem,
} from "react-aria-components";
import { CameraDialog } from "./CameraDialog";
import type { ProductFlow } from "./useProductFlow";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES } from "../../lib/images";
import { Button, buttonClass } from "../../ui/Button";
import { Icon } from "../../ui/Icon";

const filesFromDrop = (items: DropItem[]) =>
  Promise.all(
    items
      .filter((i): i is FileDropItem => i.kind === "file")
      .map((i) => i.getFile()),
  );

/** Drop zone, file picker and camera capture, with reorderable thumbnails. */
export const ImageInput: React.FC<{ flow: ProductFlow }> = ({ flow }) => {
  const [message, setMessage] = useState<string>();
  const [cameraOpen, setCameraOpen] = useState(false);
  const add = (files: File[]) => setMessage(flow.addImages(files));
  const full = flow.images.length >= MAX_IMAGES;

  return (
    <div className="grid gap-3">
      <DropZone
        aria-label="Product images drop zone"
        getDropOperation={(types) =>
          ACCEPTED_IMAGE_TYPES.some((t) => types.has(t)) && !full
            ? "copy"
            : "cancel"
        }
        onDrop={async (e) => add(await filesFromDrop(e.items))}
        className="border-line-2 bg-bg data-[drop-target]:border-accent data-[drop-target]:bg-accent-soft grid place-items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center"
      >
        <Icon name="upload" className="text-muted size-6" />
        <Text slot="label" className="font-semibold">
          Drop product images here
        </Text>
        <p className="text-muted text-[12.5px]">
          JPEG, PNG, WebP or GIF, up to {MAX_IMAGES} images. They are scaled to
          1024 px before upload.
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <FileTrigger
            acceptedFileTypes={ACCEPTED_IMAGE_TYPES}
            allowsMultiple
            onSelect={(list) => list && add(Array.from(list))}
          >
            <AriaButton className={buttonClass("secondary")} isDisabled={full}>
              <Icon name="plus" />
              Choose images
            </AriaButton>
          </FileTrigger>
          <Button onPress={() => setCameraOpen(true)} isDisabled={full}>
            <Icon name="camera" />
            Take photo
          </Button>
        </div>
      </DropZone>
      {message && (
        <p role="status" className="text-err text-[12.5px]">
          {message}
        </p>
      )}
      {flow.images.length > 0 && (
        <ul
          className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2"
          aria-label="Selected images"
        >
          {flow.images.map((img, n) => (
            <li
              key={img.id}
              className="border-line bg-surface group relative overflow-hidden rounded-md border"
            >
              <img
                src={img.url}
                alt={`Image ${n + 1}: ${img.name}`}
                className="bg-img aspect-square w-full object-contain"
              />
              <div className="flex items-center justify-between gap-1 p-1">
                <span className="text-muted truncate px-1 font-mono text-[11px]">
                  {n + 1}
                </span>
                <span className="flex">
                  <Button
                    variant="quiet"
                    size="sm"
                    className="px-1.5"
                    aria-label={`Move image ${n + 1} earlier`}
                    isDisabled={n === 0}
                    onPress={() => flow.moveImage(img.id, -1)}
                  >
                    <Icon name="chevronLeft" className="size-3.5" />
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    className="px-1.5"
                    aria-label={`Move image ${n + 1} later`}
                    isDisabled={n === flow.images.length - 1}
                    onPress={() => flow.moveImage(img.id, 1)}
                  >
                    <Icon name="chevronRight" className="size-3.5" />
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    className="hover:text-err px-1.5"
                    aria-label={`Remove image ${n + 1}`}
                    onPress={() => flow.removeImage(img.id)}
                  >
                    <Icon name="trash" className="size-3.5" />
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {cameraOpen && (
        <CameraDialog
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => setMessage(flow.addImages([file]))}
          count={flow.images.length}
        />
      )}
    </div>
  );
};
