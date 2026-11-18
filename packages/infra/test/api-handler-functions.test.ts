/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApplicationStack } from "../src/stacks/application-stack";

test("Python API handlers get 256 MB of memory", () => {
  const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
  const template = Template.fromStack(new ApplicationStack(app, "test"));

  const handlers = Object.values(
    template.findResources("AWS::Lambda::Function"),
  ).filter((fn) =>
    String(fn.Properties.Handler).startsWith(
      "amzn_smart_product_onboarding_api_python_handlers.",
    ),
  );
  expect(handlers).toHaveLength(5);
  for (const fn of handlers) {
    expect(fn.Properties.MemorySize).toBe(256);
  }
});
