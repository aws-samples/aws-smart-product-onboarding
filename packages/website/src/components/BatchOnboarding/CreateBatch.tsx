/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  useCreateBatchExecution,
  useUploadFile,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Button,
  FileUpload,
  Form,
  FormField,
  Link,
  SpaceBetween,
} from "@cloudscape-design/components";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useGlobalUIContext } from "../../hooks/useGlobalUIContext";

export interface CreateBatchProps {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  onCreateBatch: () => void;
}

const CreateBatch = (props: CreateBatchProps) => {
  const [productsFile, setProductsFile] = useState<File[]>([]);
  const [productsFileError, setProductsFileError] = useState<string>();
  const [imagesFile, setImagesFile] = useState<File[]>([]);
  const [imagesFileError, setImagesFileError] = useState<string>();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addFlashItem, makeHelpPanelHandler } = useGlobalUIContext();

  const resetForm = () => {
    setProductsFile([]);
    setProductsFileError(undefined);
    setImagesFile([]);
    setImagesFileError(undefined);
  };

  function validateFile(
    file: File[],
    setFileError: Dispatch<SetStateAction<string | undefined>>,
    allowedTypes: string[],
    errorMessage: string,
  ) {
    if (file.length === 0) {
      setFileError("Please upload a file");
      return false;
    } else if (file.length > 1) {
      setProductsFileError("Please upload a single file");
      return false;
    } else if (!allowedTypes.includes(file[0].type)) {
      setFileError(errorMessage);
      return false;
    }
    return true;
  }

  async function validateProductsFile(
    file: File[],
    setFileError: Dispatch<SetStateAction<string | undefined>>,
  ): Promise<boolean> {
    try {
      if (!file?.length) {
        setFileError("No file provided");
        return false;
      }

      const isValidFile = validateFile(
        file,
        setFileError,
        ["text/plain", "text/csv"],
        "Please upload a csv file with headers",
      );

      if (!isValidFile) {
        return false;
      }

      const text = await file[0].text(); // More modern approach than FileReader
      const firstLine = text.split("\n")[0]?.trim();

      if (!firstLine) {
        setFileError("File appears to be empty");
        return false;
      }

      const headers = firstLine
        .toLowerCase()
        .split(",")
        .map((h) => h.trim());
      const requiredHeaderSets = [["title", "description"], ["images"]];

      const hasRequiredHeaders = requiredHeaderSets.some((set) =>
        set.every((header) => headers.includes(header)),
      );

      if (!hasRequiredHeaders) {
        setFileError(
          "Your CSV must contain 'title' and 'description' columns or an 'images' column",
        );
        return false;
      }

      if (headers.includes("images") && imagesFile.length !== 1) {
        setFileError("Your CSV contains an images column, add an images file.");
        return false;
      }
      setFileError(undefined);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        setFileError(`Error processing file: ${error.message}`);
      } else {
        setFileError(`Error processing file`);
      }
      return false;
    }
  }

  async function validateImagesFile(
    file: File[],
    setFileError: Dispatch<SetStateAction<string | undefined>>,
  ): Promise<boolean> {
    try {
      if (!file?.length) {
        // images file is optional
        setFileError(undefined);
        return true;
      }

      const isValidFile = validateFile(
        file,
        setFileError,
        ["application/zip"],
        "Please upload a zip file with images",
      );
      if (!isValidFile) {
        return false;
      } else {
        setFileError(undefined);
        return true;
      }
    } catch (error) {
      if (error instanceof Error) {
        setFileError(`Error processing file: ${error.message}`);
      } else {
        setFileError(`Error processing file`);
      }
      return false;
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const [productsValid, imagesValid] = await Promise.all([
      validateProductsFile(productsFile, setProductsFileError),
      validateImagesFile(imagesFile, setImagesFileError),
    ]);

    return productsValid && imagesValid;
  };

  useEffect(() => {
    if (productsFileError) {
      void validateProductsFile(productsFile, setProductsFileError);
    }
  }, [productsFile, productsFileError, setProductsFileError, imagesFile]);

  useEffect(() => {
    if (imagesFileError) {
      void validateImagesFile(imagesFile, setImagesFileError);
    }
  }, [imagesFile, imagesFileError, setImagesFileError]);

  function onDismiss() {
    resetForm();
    props.setVisible(false);
  }

  const createBatchExecution = useCreateBatchExecution({
    onError: (error) => {
      console.log(error);
      addFlashItem({
        type: "error",
        content: "Failed to start onboarding",
      });
      setIsSubmitting(false);
    },
    onSuccess: (data) => {
      console.log(data);
      resetForm();
      props.setVisible(false);
      addFlashItem({
        type: "info",
        content: <>Onboarding started: {data.executionId}</>,
      });
      setIsSubmitting(false);
      props.onCreateBatch();
    },
  });

  const uploadCatalog = useUploadFile({
    onError: (err) => {
      console.error(`Failed to upload catalog: ${JSON.stringify(err)}`);
      addFlashItem({ type: "error", content: "Failed to upload catalog!" });
    },
  });

  const uploadImages = useUploadFile({
    onError: (err) => {
      console.error(`Failed to upload images: ${JSON.stringify(err)}`);
      addFlashItem({ type: "error", content: "Failed to upload images!" });
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

  const onCreate = async (products: File, images?: File) => {
    setIsSubmitting(true);

    const uploadCatalogPromise = uploadCatalog.mutateAsync({
      uploadFileRequestContent: {
        fileName: products.name,
      },
    });

    // in case there are no images we will use a fake promise that resolves to undefined url and key
    const uploadImagesPromise = images
      ? uploadImages.mutateAsync({
          uploadFileRequestContent: {
            fileName: images.name,
          },
        })
      : Promise.resolve({
          url: undefined,
          objectKey: undefined,
        });

    // @ts-ignore
    const [{ url, objectKey }, { url: imagesUrl, objectKey: imagesObjectKey }] =
      await Promise.all([uploadCatalogPromise, uploadImagesPromise]).catch(
        (_e) =>
          addFlashItem({
            type: "error",
            content: "Failed to generate presigned upload URLs!",
          }),
      );

    await Promise.all([
      putFile(url, products, new Headers({ "Content-type": "text/csv" })),
      putFile(
        imagesUrl,
        images,
        new Headers({ "Content-type": "application/zip" }),
      ),
    ]).catch((_e) =>
      addFlashItem({
        type: "error",
        content: "Failed to upload files using presigned URLs",
      }),
    );

    createBatchExecution.mutate({
      createBatchExecutionRequestContent: {
        inputFile: objectKey!,
        compressedImagesFile: imagesObjectKey!,
      },
    });
  };

  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <Form
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={(e) => {
                e.preventDefault();
                onDismiss();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={createBatchExecution.isLoading || isSubmitting}
              loading={createBatchExecution.isLoading || isSubmitting}
              onClick={async (e) => {
                e.preventDefault();
                const isValid = await validateForm();
                if (!isValid) return;
                void onCreate(productsFile[0], imagesFile[0]);
              }}
            >
              Start Onboarding
            </Button>
          </SpaceBetween>
        }
        header={<h3>New Batch</h3>}
      >
        <SpaceBetween size="m" direction="vertical">
          <FormField
            label="Product Catalog"
            errorText={productsFileError}
            info={
              <Link
                variant="info"
                onClick={() => {
                  makeHelpPanelHandler("create-batch:products-csv");
                }}
              >
                Info
              </Link>
            }
          >
            <FileUpload
              value={productsFile}
              onChange={(e) => setProductsFile(e.detail.value)}
              i18nStrings={{
                uploadButtonText: (e) => (e ? "Choose files" : "Choose file"),
                dropzoneText: (e) =>
                  e ? "Drop files to upload" : "Drop file to upload",
                removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                limitShowFewer: "Show fewer files",
                limitShowMore: "Show more files",
                errorIconAriaLabel: "Error",
              }}
              showFileLastModified
              showFileSize
              constraintText="Upload a single CSV file with headers."
            />
          </FormField>
          <FormField
            label="Product Images"
            errorText={imagesFileError}
            info={
              <Link
                variant="info"
                onClick={() => {
                  makeHelpPanelHandler("create-batch:images-zip");
                }}
              >
                Info
              </Link>
            }
          >
            <FileUpload
              value={imagesFile}
              onChange={(e) => setImagesFile(e.detail.value)}
              i18nStrings={{
                uploadButtonText: (e) => (e ? "Choose files" : "Choose file"),
                dropzoneText: (e) =>
                  e ? "Drop files to upload" : "Drop file to upload",
                removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                limitShowFewer: "Show fewer files",
                limitShowMore: "Show more files",
                errorIconAriaLabel: "Error",
              }}
              showFileLastModified
              showFileSize
              constraintText="Optional: Upload a single zip file with images with images to be used in the batch."
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </form>
  );
};

export default CreateBatch;
