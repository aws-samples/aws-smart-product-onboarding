/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { reachableSteps } from "./ProductPage";

const flow = {
  product: undefined,
  generating: false,
  genStatus: "idle" as const,
  classified: false,
  classifying: false,
};

describe("reachableSteps", () => {
  it("keeps the generate step open after the first generation failed", () => {
    expect(reachableSteps({ ...flow, genStatus: "error" })).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect(reachableSteps(flow)[1]).toBe(false);
  });
});
