/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import FileUpload from "@cloudscape-design/components/file-upload";
import FormField from "@cloudscape-design/components/form-field";
import { useState } from "react";

type ImageError = string | null;

export interface ImageUploaderProps {
  value: File[];
  setValue: (value: File[]) => void;
}

const maxImages = 20;
const ImageUploader: React.FC<ImageUploaderProps> = (
  props: ImageUploaderProps,
) => {
  const { value, setValue } = props;
  const [errorList, setErrorList] = useState<ImageError[]>([]);
  const [error, setError] = useState<string | undefined>();

  const validateImage = (file: File): ImageError => {
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return "The image must be in JPG, PNG, GIF, or WebP format";
    }
    return null;
  };

  return (
    <FormField
      label="Upload Images"
      description="Upload images of your product"
      errorText={error}
    >
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
          setValue(detail.value);
          setErrorList(detail.value.map(validateImage));
        }}
        value={value}
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
    </FormField>
  );
};

export default ImageUploader;
