/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App, Aspects } from "aws-cdk-lib";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import { AwsSolutionsChecks } from "cdk-nag";
import { ApplicationStack } from "../src/stacks/application-stack";

test("No unsuppressed Errors", () => {
  const app = new App();
  Aspects.of(app).add(new AwsSolutionsChecks());
  const stack = new ApplicationStack(app, "test");
  app.synth();
  const errors = Annotations.fromStack(stack).findError(
    "*",
    Match.stringLikeRegexp("AwsSolutions-.*"),
  );
  const errorData = errors.map((error) => error.entry.data);
  expect(errorData).toHaveLength(0);
});
