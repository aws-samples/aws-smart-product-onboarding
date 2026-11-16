/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

// Matches Claude IDs named claude-<family>-<major>[-<minor>], e.g. claude-haiku-4-5-20251001-v1:0
const CLAUDE_VERSION =
  /anthropic\.claude-[a-z]+-(\d+)(?:-(\d{1,2}))?(?=[-:]|$)/;

function claudeVersion(modelId: string): [number, number] | undefined {
  const match = CLAUDE_VERSION.exec(modelId);
  if (!match) {
    return undefined;
  }
  return [Number(match[1]), Number(match[2] ?? 0)];
}

function isAtLeast(
  version: [number, number] | undefined,
  major: number,
  minor: number,
): boolean {
  return (
    version !== undefined &&
    (version[0] > major || (version[0] === major && version[1] >= minor))
  );
}

/** Claude 4.6 and later reject a final assistant message (prefill). */
export function supportsPrefill(modelId: string): boolean {
  return !isAtLeast(claudeVersion(modelId), 4, 6);
}

/** Claude 4.7 and later reject the temperature inference parameter. */
export function supportsTemperature(modelId: string): boolean {
  return !isAtLeast(claudeVersion(modelId), 4, 7);
}
