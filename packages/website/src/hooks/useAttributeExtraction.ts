/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  ResponseError,
  useExtractAttributes,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { useGlobalUIContext } from "./useGlobalUIContext";

export interface UseAttributeExtractionType {
  extractAttributes: ReturnType<typeof useExtractAttributes>;
  handleReset: () => void;
}

const getRetryDelay = (count: number, e: ResponseError): number => {
  const jitter = Math.random() * 1000;
  if (e?.message.startsWith("Retryable")) {
    return Math.max(30000 * Math.pow(2, count - 1), 60000) + jitter;
  } else {
    return 1000 * Math.pow(2, count - 1) + jitter;
  }
};

export const useAttributeExtraction = (): UseAttributeExtractionType => {
  const { addFlashItem } = useGlobalUIContext();

  const extractAttributes = useExtractAttributes({
    retry: 3,
    retryDelay: getRetryDelay,
    onError: (e) => {
      console.log(e);
      addFlashItem({
        type: "error",
        content: "Failed to extract attributes",
      });
    },
  });

  const handleReset = () => {
    extractAttributes.reset();
  };

  return {
    extractAttributes,
    handleReset,
  };
};
