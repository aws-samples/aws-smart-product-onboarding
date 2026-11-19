/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import type { GenerationModel } from "../../api/client";
import type { GenerationOptions } from "../../lib/drafts";

/** Multimodal models the API accepts. Without a choice, the API uses the model configured for the deployment. */
export const MODELS: { id: GenerationModel; label: string }[] = [
  {
    id: "global.anthropic.claude-haiku-5-5",
    label: "Anthropic Claude Haiku 5.5",
  },
  {
    id: "global.anthropic.claude-sonnet-5-5",
    label: "Anthropic Claude Sonnet 5.5",
  },
  {
    id: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Anthropic Claude Haiku 4.5",
  },
  { id: "global.amazon.nova-2-lite-v1:0", label: "Amazon Nova 2 Lite" },
  { id: "us.amazon.nova-lite-v1:0", label: "Amazon Nova Lite" },
  { id: "us.amazon.nova-pro-v1:0", label: "Amazon Nova Pro" },
];

export const modelLabel = (id?: string) =>
  MODELS.find((m) => m.id === id)?.label ?? id ?? "";

export const DEFAULT_OPTIONS: GenerationOptions = {
  language: "",
  descriptionLength: "long",
  model: "",
  temperature: 0.1,
};

export const MAX_EXAMPLES = 5;
export const MAX_LANGUAGE_LENGTH = 200;
