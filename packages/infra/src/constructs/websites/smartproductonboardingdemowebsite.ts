/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { UserIdentity } from "@aws/pdk/identity";
import { aws_s3 as s3, Stack } from "aws-cdk-lib";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { SmartProductOnboardingAPI } from "../apis/smartproductonboardingapi";

/**
 * Website construct props
 */
export interface SmartproductonboardingdemowebsiteProps {
  /**
   * Instance of an API to configure the website to integrate with
   */
  readonly smartproductonboardingapi: SmartProductOnboardingAPI;

  /**
   * Instance of the UserIdentity.
   */
  readonly userIdentity: UserIdentity;
  readonly inputBucket: s3.IBucket;
  readonly configBucket: s3.IBucket;
}

/**
 * Construct to deploy a Static Website
 */
export class Smartproductonboardingdemowebsite extends Construct {
  public readonly websiteUrl: string;

  constructor(
    scope: Construct,
    id: string,
    props: SmartproductonboardingdemowebsiteProps,
  ) {
    super(scope, id);

    const runtimeConfig = {
      region: Stack.of(this).region,
      identityPoolId: props.userIdentity.identityPool.identityPoolId,
      userPoolId: props.userIdentity.userPool?.userPoolId,
      userPoolWebClientId: props.userIdentity.userPoolClient?.userPoolClientId,
      typeSafeApis: {
        "smart-product-onboarding-api":
          props?.smartproductonboardingapi.api.api.urlForPath(),
      },
      typeSafeWebSocketApis: {},
      inputBucket: props.inputBucket.bucketName,
    };

    new BucketDeployment(this, "RuntimeConfig", {
      sources: [Source.jsonData("runtime-config.json", runtimeConfig)],
      destinationBucket: props.configBucket,
      destinationKeyPrefix: "frontend/",
    });

    this.websiteUrl = "See packages/website/README.md";
  }
}
