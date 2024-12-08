/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CdkGraph, FilterPreset, Filters } from "@aws/pdk/cdk-graph";
import { CdkGraphDiagramPlugin } from "@aws/pdk/cdk-graph-plugin-diagram";
import { CdkGraphThreatComposerPlugin } from "@aws/pdk/cdk-graph-plugin-threat-composer";
import { PDKNag } from "@aws/pdk/pdk-nag";
import { PDKPipeline } from "@aws/pdk/pipeline";
import { AwsSolutionsChecks } from "cdk-nag";
import { ApplicationStack } from "./stacks/application-stack";

/* eslint-disable @typescript-eslint/no-floating-promises */
(async () => {
  const app = PDKNag.app({
    nagPacks: [new AwsSolutionsChecks()],
  });

  const branchPrefix = PDKPipeline.getBranchPrefix({ node: app.node });

  // Use this to deploy your own sandbox environment (assumes your CLI credentials)
  new ApplicationStack(app, branchPrefix + "smart-product-onboarding", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
    description:
      "The Smart Product Onboarding accelerator demonstrates an innovative approach to enhancing the product onboarding process for e-commerce platforms. (uksb-4egfcqqzhk)",
  });

  const graph = new CdkGraph(app, {
    plugins: [
      new CdkGraphDiagramPlugin({
        defaults: {
          filterPlan: {
            preset: FilterPreset.COMPACT,
            filters: [{ store: Filters.pruneCustomResources() }],
          },
        },
      }),
      new CdkGraphThreatComposerPlugin(),
    ],
  });

  app.synth();
  await graph.report();
})();
