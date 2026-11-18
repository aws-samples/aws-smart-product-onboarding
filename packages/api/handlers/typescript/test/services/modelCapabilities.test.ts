/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  supportsPrefill,
  supportsTemperature,
} from "../../src/services/modelCapabilities";

describe("modelCapabilities", () => {
  it.each([
    ["us.amazon.nova-lite-v1:0", true, true],
    ["global.amazon.nova-2-lite-v1:0", true, true],
    ["us.anthropic.claude-3-haiku-20240307-v1:0", true, true],
    ["global.anthropic.claude-haiku-4-5-20251001-v1:0", true, true],
    ["global.anthropic.claude-sonnet-4-20250514-v1:0", true, true],
    ["global.anthropic.claude-sonnet-4-6", false, true],
    ["global.anthropic.claude-opus-4-7", false, false],
    ["global.anthropic.claude-haiku-5-5", false, false],
    ["global.anthropic.claude-sonnet-5-5", false, false],
  ])("%s prefill=%s temperature=%s", (modelId, prefill, temperature) => {
    expect(supportsPrefill(modelId)).toBe(prefill);
    expect(supportsTemperature(modelId)).toBe(temperature);
  });
});
