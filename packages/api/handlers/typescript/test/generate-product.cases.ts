/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  ResourceNotFoundException,
  ThrottlingException,
  ValidationException,
} from "@aws-sdk/client-bedrock-runtime";

export interface ResponseCase {
  readonly name: string;
  readonly body: unknown;
  readonly env?: { [key: string]: string | undefined };
  /**
   * Result of the product generator. Receives the handler's own copy of the exceptions module.
   */
  readonly generate?: (exceptions: any) => Promise<unknown>;
  readonly appConfigError?: boolean;
}

const success = async () => ({
  productData: { title: "T", description: "D" },
  usage: { inputTokens: 10, outputTokens: 20 },
});

const meta = { $metadata: {} };

/**
 * One request for each response path of the generateProduct handler.
 */
export const RESPONSE_CASES: ResponseCase[] = [
  {
    name: "success",
    body: { productImages: ["image1.jpg"] },
    generate: success,
  },
  {
    name: "success without usage",
    body: { productImages: ["image1.jpg"], language: "Chilean Spanish" },
    generate: async () => ({ productData: { title: "T", description: "D" } }),
  },
  {
    name: "temperature out of range",
    body: { productImages: ["image1.jpg"], temperature: 1.5 },
    generate: success,
  },
  {
    name: "image bucket not configured",
    body: { productImages: ["image1.jpg"] },
    env: { IMAGE_BUCKET: undefined },
    generate: success,
  },
  {
    name: "bedrock validation error",
    body: { productImages: ["image1.jpg"] },
    generate: async () => {
      throw new ValidationException({ message: "bad", ...meta });
    },
  },
  {
    name: "bedrock resource not found",
    body: { productImages: ["image1.jpg"] },
    generate: async () => {
      throw new ResourceNotFoundException({ message: "missing", ...meta });
    },
  },
  {
    name: "bedrock throttling",
    body: { productImages: ["image1.jpg"] },
    generate: async () => {
      throw new ThrottlingException({ message: "slow down", ...meta });
    },
  },
  {
    name: "invalid input",
    body: { productImages: ["image1.jpg"] },
    generate: async ({ BadRequestError }) => {
      throw new BadRequestError("Image image1.jpg is not a supported format");
    },
  },
  {
    name: "unexpected error",
    body: { productImages: ["image1.jpg"] },
    generate: async () => {
      throw new Error("boom");
    },
  },
  {
    name: "configuration error",
    body: { productImages: ["image1.jpg"] },
    appConfigError: true,
  },
];
