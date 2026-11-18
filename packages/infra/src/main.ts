/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App, Aspects } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { getBranchPrefix } from "./branch-prefix";
import { ApplicationStack } from "./stacks/application-stack";

const app = new App();
Aspects.of(app).add(new AwsSolutionsChecks());

const branchPrefix = getBranchPrefix(app.node);

// Use this to deploy your own sandbox environment (assumes your CLI credentials)
new ApplicationStack(app, branchPrefix + "smart-product-onboarding", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description:
    "The Smart Product Onboarding accelerator demonstrates an innovative approach to enhancing the product onboarding process for e-commerce platforms. (uksb-4egfcqqzhk)",
});

app.synth();
