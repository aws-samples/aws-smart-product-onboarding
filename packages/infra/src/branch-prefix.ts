/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Node } from "constructs";

const DEFAULT_BRANCH_NAME = "mainline";

/**
 * Prefix for resource names when deploying a branch other than the default one.
 *
 * Returns "" when the BRANCH environment variable is unset or names the default
 * branch (the `defaultBranchName` context value, or "mainline"). Otherwise
 * returns BRANCH with every character other than letters, digits and "-"
 * replaced by "-", followed by "-".
 */
export function getBranchPrefix(node: Node): string {
  const branch = process.env.BRANCH;
  const defaultBranch =
    node.tryGetContext("defaultBranchName") || DEFAULT_BRANCH_NAME;
  if (!branch || branch === defaultBranch) {
    return "";
  }
  return branch.replace(/[^a-zA-Z0-9-]/g, "-") + "-";
}
