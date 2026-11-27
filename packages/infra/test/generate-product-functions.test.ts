/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ApplicationStack } from "../src/stacks/application-stack";

const HANDLERS =
  "amzn_smart_product_onboarding_product_categorization.aws_lambda.";

const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
const template = Template.fromStack(new ApplicationStack(app, "test"));
const resources = template.toJSON().Resources;

/** The statements of the inline policies attached to a function's role. */
function statements(fn: any): any[] {
  const role = fn.Properties.Role["Fn::GetAtt"][0];
  return Object.values<any>(template.findResources("AWS::IAM::Policy"))
    .filter((policy) =>
      policy.Properties.Roles.some((r: any) => r.Ref === role),
    )
    .flatMap((policy) => policy.Properties.PolicyDocument.Statement);
}

const asArray = (value: unknown) => (Array.isArray(value) ? value : [value]);

describe.each([
  [
    "ApiGenerateProductFunction2D66D00D",
    "generate_product_apigw.handler",
    "uploads/*",
  ],
  [
    "CategorizationWorkflowGenerateProductTaskFunction",
    "generate_product.handler",
    "*",
  ],
])("%s", (logicalIdPrefix, handler, imageKeys) => {
  const [, fn] = Object.entries<any>(resources).find(
    ([id, r]) =>
      id.startsWith(logicalIdPrefix) && r.Type === "AWS::Lambda::Function",
  )!;

  test("runs the Python handler from the container image", () => {
    expect(fn.Properties.PackageType).toBe("Image");
    expect(fn.Properties.ImageConfig.Command).toEqual([HANDLERS + handler]);
    expect(fn.Properties.Architectures).toEqual(["arm64"]);
  });

  test("may only call Converse and read the images", () => {
    const actions = statements(fn).flatMap((s) => asArray(s.Action));
    expect(actions).toContain("bedrock:InvokeModel");
    expect(actions).not.toContain("bedrock:InvokeModelWithResponseStream");
    expect(actions.filter((a) => a.startsWith("s3:"))).toEqual([
      "s3:GetObject",
    ]);

    const s3 = statements(fn).find((s) => s.Action === "s3:GetObject");
    expect(JSON.stringify(s3.Resource)).toContain(`"/${imageKeys}"`);
  });
});
