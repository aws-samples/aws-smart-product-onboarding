/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { getBranchPrefix } from "../src/branch-prefix";
import { ApplicationStack } from "../src/stacks/application-stack";

describe("getBranchPrefix", () => {
  const original = process.env.BRANCH;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.BRANCH;
    } else {
      process.env.BRANCH = original;
    }
  });

  test("is empty without BRANCH or on the default branch", () => {
    const app = new App();
    delete process.env.BRANCH;
    expect(getBranchPrefix(app.node)).toBe("");
    process.env.BRANCH = "mainline";
    expect(getBranchPrefix(app.node)).toBe("");
  });

  test("uses the defaultBranchName context value", () => {
    const app = new App({ context: { defaultBranchName: "main" } });
    process.env.BRANCH = "main";
    expect(getBranchPrefix(app.node)).toBe("");
    process.env.BRANCH = "mainline";
    expect(getBranchPrefix(app.node)).toBe("mainline-");
  });

  test("normalizes other branch names", () => {
    process.env.BRANCH = "feature/new_UI.2";
    expect(getBranchPrefix(new App().node)).toBe("feature-new-UI-2-");
  });
});

test("identity resources keep their logical IDs", () => {
  delete process.env.BRANCH;
  const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
  const template = Template.fromStack(
    new ApplicationStack(app, "smart-product-onboarding"),
  );
  const resources = template.toJSON().Resources;
  const expected: Record<string, string> = {
    DemoUserPool1AB98549: "AWS::Cognito::UserPool",
    DemoUserPoolWebClient3C1F8A5C: "AWS::Cognito::UserPoolClient",
    smartproductonboardingUserIdentityIdentityPoolCCFE9607:
      "AWS::Cognito::IdentityPool",
    smartproductonboardingUserIdentityIdentityPoolAuthenticatedRoleC6B6F9BA:
      "AWS::IAM::Role",
    smartproductonboardingUserIdentityIdentityPoolUnauthenticatedRole34988872:
      "AWS::IAM::Role",
    smartproductonboardingUserIdentityIdentityPoolDefaultRoleAttachment3A17558D:
      "AWS::Cognito::IdentityPoolRoleAttachment",
  };
  for (const [logicalId, type] of Object.entries(expected)) {
    expect(resources[logicalId]?.Type).toBe(type);
  }
  template.hasResourceProperties("AWS::Cognito::IdentityPool", {
    AllowUnauthenticatedIdentities: false,
  });
});
