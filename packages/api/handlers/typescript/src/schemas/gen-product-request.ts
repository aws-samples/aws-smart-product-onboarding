/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import type { components } from "@aws-samples/smart-product-onboarding-api-types";
import { z } from "zod";

export type GenProductRequestContent =
  components["schemas"]["GenProductRequestContent"];
export type GenProductResponseContent =
  components["schemas"]["GenProductResponseContent"];

const productDataSchema = z.object({
  title: z.string(),
  description: z.string(),
  shortDescription: z.string().optional(),
  metadata: z.string().optional(),
});

/**
 * The generateProduct request body, as defined in the OpenAPI definition.
 * API Gateway validates requests first; this schema is a backstop inside the function.
 */
export const genProductRequestSchema = z.object({
  language: z.string().optional(),
  descriptionLength: z.enum(["short", "medium", "long"]).optional(),
  productImages: z.array(z.string()).max(20),
  metadata: z.string().optional(),
  temperature: z.number().optional(),
  model: z
    .enum([
      "us.amazon.nova-lite-v1:0",
      "us.amazon.nova-pro-v1:0",
      "global.amazon.nova-2-lite-v1:0",
      "global.anthropic.claude-haiku-4-5-20251001-v1:0",
      "global.anthropic.claude-haiku-5-5",
      "global.anthropic.claude-sonnet-5-5",
    ])
    .optional(),
  examples: z.array(productDataSchema).max(5).optional(),
});

// Fails to compile if the schema and the type generated from the OpenAPI definition drift apart.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const schemaMatchesSpec: Equals<
  z.infer<typeof genProductRequestSchema>,
  GenProductRequestContent
> = true;
void schemaMatchesSpec;
