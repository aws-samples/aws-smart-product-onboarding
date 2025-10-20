/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  GenProductRequestContentModelEnum,
  ProductData,
  useGenerateProduct,
  useUploadFile,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { useState } from "react";
import { useGlobalUIContext } from "./useGlobalUIContext";
import { LLMOptions } from "../components/GenerationOptions/LLMOptionsForm";
import { prepareImages } from "../components/GenProductData/resizeImages";

export interface S3Image {
  data: Blob;
  type: string;
  key: string;
}

export interface UseProductGenerationType {
  imageFiles: File[];
  setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  productMetadata: string;
  setProductMetadata: React.Dispatch<React.SetStateAction<string>>;
  examples: ProductData[];
  setExamples: React.Dispatch<React.SetStateAction<ProductData[]>>;
  llmOptions: LLMOptions;
  setLLMOptions: React.Dispatch<React.SetStateAction<LLMOptions>>;
  status: string;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  generateProduct: ReturnType<typeof useGenerateProduct>;
  handleReset: () => void;
  generateProductData: () => Promise<void>;
}

export const useProductGeneration = (
  setProductData?: React.Dispatch<React.SetStateAction<Partial<ProductData>>>,
): UseProductGenerationType => {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [productMetadata, setProductMetadata] = useState<string>("");
  const [examples, setExamples] = useState<ProductData[]>([]);
  const [llmOptions, setLLMOptions] = useState<LLMOptions>({
    descriptionLength: "long",
    temperature: 0.1,
  });
  const [s3Images, setS3Images] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");

  const { addFlashItem } = useGlobalUIContext();

  const generateProduct = useGenerateProduct({
    onSettled: () => setStatus(""),
    onError: (error) => {
      console.log(error);
      setStatus("Error");
      addFlashItem({
        type: "error",
        content: "Failed to generate product data",
      });
    },
    onSuccess: (data) => {
      if (setProductData) {
        setProductData(data.product);
      }
      setStatus("Success");
      console.log(data);
    },
  });

  const putFile = async (
    url?: string,
    body?: BodyInit,
    headers?: HeadersInit,
  ) => {
    if (!url) {
      return;
    }

    const response = await window.fetch(new URL(url), {
      method: "PUT",
      headers,
      body,
    });

    if (!response.ok) {
      console.error(`Uploading failed: ${response.status}`);
      throw new Error();
    }
  };

  const uploadImage = useUploadFile({
    onError: (err) => {
      console.error(`Failed to upload images: ${JSON.stringify(err)}`);
      addFlashItem({ type: "error", content: "Failed to upload image!" });
    },
  });

  async function uploadImageToS3(image: S3Image): Promise<string> {
    /*
                    Uploads an image to S3, returns the object key it was uploaded to.
                     */
    return uploadImage
      .mutateAsync({
        uploadFileRequestContent: {
          fileName: image.key,
        },
      })
      .then(async ({ url, objectKey }) => {
        if (!objectKey) {
          throw new Error("objectKey should have been populated");
        }

        console.log(`Generated url for ${image.key}`);
        try {
          await putFile(
            url,
            image.data,
            new Headers({ "Content-Type": image.type }),
          );
          return objectKey;
        } catch (e) {
          console.log(`Failed to upload ${image.key}`);
          throw e;
        }
      })
      .catch((error) => {
        console.log(`Failed to upload ${image.key}`);
        throw error;
      });
  }

  async function generateProductData() {
    console.log("Generate product data");
    let objectKeys: string[] = [];
    if (s3Images.length === 0) {
      console.log("Prepare images for upload");
      setStatus("Preparing");
      const images = await prepareImages(imageFiles);

      console.log("Upload images to S3");
      setStatus("Uploading");

      const imageKeys: S3Image[] = images.map((img) => {
        return {
          data: img.data,
          type: img.type,
          key: img.name,
        };
      });
      const uploads = imageKeys.map(uploadImageToS3);
      try {
        objectKeys.push(...(await Promise.all(uploads)));
        setS3Images(objectKeys);
      } catch (e) {
        console.log("Failed to upload images");
        setStatus("Error");
        addFlashItem({
          type: "error",
          content: "Failed to upload images",
        });
        return;
      }
    } else {
      objectKeys = s3Images;
    }

    console.log("Request product data");
    setStatus("Generating");
    generateProduct.mutate({
      genProductRequestContent: {
        language: llmOptions.language,
        productImages: objectKeys,
        metadata: productMetadata,
        model: llmOptions.model
          ? (llmOptions.model.value as GenProductRequestContentModelEnum)
          : undefined,
        temperature: llmOptions.temperature,
        descriptionLength: llmOptions.descriptionLength,
        examples: examples,
      },
    });
  }

  const handleReset = () => {
    setImageFiles([]);
    setProductMetadata("");
    setExamples([]);
    setLLMOptions({});
    setS3Images([]);
    setStatus("");
    generateProduct.reset();
  };

  return {
    imageFiles,
    setImageFiles,
    productMetadata,
    setProductMetadata,
    examples,
    setExamples,
    llmOptions,
    setLLMOptions,
    status,
    setStatus,
    generateProduct,
    handleReset,
    generateProductData,
  };
};
