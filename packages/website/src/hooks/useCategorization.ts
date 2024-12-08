/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  ProductData,
  ResponseError,
  useCategorizeProduct,
  useMetaclass,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { useGlobalUIContext } from "./useGlobalUIContext";

export interface UseCategorizationType {
  metaclass: ReturnType<typeof useMetaclass>;
  categorizeProduct: ReturnType<typeof useCategorizeProduct>;
  startCategorization: (product: ProductData) => void;
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

export const useCategorization = (): UseCategorizationType => {
  const { addFlashItem } = useGlobalUIContext();

  const metaclass = useMetaclass({
    retry: 3,
    retryDelay: getRetryDelay,
    onError: (e) => {
      console.log(e);
      addFlashItem({
        type: "error",
        content: "Failed to determine metaclass",
      });
    },
  });

  const categorizeProduct = useCategorizeProduct({
    retry: 3,
    retryDelay: getRetryDelay,
    onError: (e) => {
      console.log(e);
      addFlashItem({
        type: "error",
        content: "Failed to categorize product",
      });
    },
  });

  const startCategorization = async (product: ProductData) => {
    try {
      const metaclassResponse = await metaclass.mutateAsync({
        metaclassRequestContent: {
          product,
        },
      });
      categorizeProduct.mutate({
        categorizeProductRequestContent: {
          possibleCategories: metaclassResponse.possibleCategories,
          product,
          demo: true,
        },
      });
    } catch (e) {
      console.log(e);
      addFlashItem({
        type: "error",
        content: "Failed to categorize product",
      });
      return;
    }
  };

  const handleReset = () => {
    metaclass.reset();
    categorizeProduct.reset();
  };

  return {
    metaclass,
    categorizeProduct,
    startCategorization,
    handleReset,
  };
};
