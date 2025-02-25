/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Button, SpaceBetween } from "@cloudscape-design/components";
import FileUpload from "@cloudscape-design/components/file-upload";
import FormField from "@cloudscape-design/components/form-field";
import { useState } from "react";
import CameraCapture from "./CameraCapture";

type ImageError = string | null;

export interface ImageUploaderProps {
  imageFiles: File[];
  setImageFiles: (value: File[]) => void;
}

const maxImages = 20;
const ImageUploader: React.FC<ImageUploaderProps> = (
  props: ImageUploaderProps,
) => {
  const { imageFiles, setImageFiles } = props;
  const [errorList, setErrorList] = useState<ImageError[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [useCameraMode, setUseCameraMode] = useState(false);

  const validateImage = (file: File): ImageError => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "The image must be in JPG, PNG, GIF, or WebP format";
    }
    return null;
  };

  const handleCameraCapture = (file: File) => {
    const newValue = [...imageFiles, file];
    if (newValue.length > maxImages) {
      setError(`Please use fewer than ${maxImages} images`);
      return;
    }
    setImageFiles(newValue);
    setError(undefined);
    setErrorList(newValue.map(validateImage));
    setUseCameraMode(false);
  };

  return (
    <FormField
      label="Upload Images"
      description="Upload images of your product"
      errorText={error}
    >
      {!useCameraMode ? (
        <SpaceBetween direction="vertical" size="s">
          <FileUpload
            onChange={({ detail }) => {
              if (detail.value.length > maxImages) {
                setError(`Please use fewer than ${maxImages} images`);
                return;
              } else if (detail.value.length === 0) {
                setError("Please use at least one image");
              } else {
                setError(undefined);
              }
              setImageFiles(detail.value);
              setErrorList(detail.value.map(validateImage));
            }}
            value={imageFiles}
            i18nStrings={{
              uploadButtonText: (e) => (e ? "Choose images" : "Choose image"),
              dropzoneText: (e) =>
                e ? "Drop images to upload" : "Drop image to upload",
              removeFileAriaLabel: (e) => `Remove image ${e + 1}`,
              limitShowFewer: "Show fewer images",
              limitShowMore: "Show more images",
              errorIconAriaLabel: "Error",
            }}
            multiple
            accept="image/png,image/jpeg,image/gif,image/webp"
            fileErrors={errorList}
            showFileLastModified
            showFileSize
            showFileThumbnail
            tokenLimit={3}
            constraintText="Supported image formats are JPEG, PNG, GIF, and WebP."
          />
          <Button
            onClick={() => setUseCameraMode(true)}
            iconName="video-camera-on"
          >
            Take Photo with Camera
          </Button>
        </SpaceBetween>
      ) : (
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setUseCameraMode(false)}
        />
      )}
    </FormField>
  );
};

export default ImageUploader;
