/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApplicationStack } from "../src/stacks/application-stack";

test("the product generation functions run on Node.js 24", () => {
  const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
  const template = Template.fromStack(new ApplicationStack(app, "test"));

  const functions = Object.entries(
    template.findResources("AWS::Lambda::Function"),
  ).filter(([logicalId]) => logicalId.includes("GenerateProduct"));

  expect(functions.length).toBeGreaterThanOrEqual(2);
  for (const [, fn] of functions) {
    expect(fn.Properties.Runtime).toBe("nodejs24.x");
  }
});
