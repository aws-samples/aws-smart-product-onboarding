/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import * as path from "path";

import {
  ArnFormat,
  aws_ecr_assets as ecr_assets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
  Duration,
  Stack,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface MetaclassTaskFunctionProps {
  configBucket: s3.IBucket;
  ssmParameterPrefix: string;
  wordEmbeddingsPolicy: iam.IManagedPolicy;
  cmd?: string[];
  timeout?: Duration;
}

export class MetaclassTaskFunction extends lambda.DockerImageFunction {
  constructor(scope: Construct, id: string, props: MetaclassTaskFunctionProps) {
    super(scope, id, {
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(
          __dirname,
          "..",
          "..",
          "..",
          "..",
          "smart-product-onboarding",
        ),
        {
          file: "metaclasses.Dockerfile",
          platform: ecr_assets.Platform.LINUX_AMD64,
          cmd: props.cmd,
        },
      ),
      environment: {
        CONFIG_BUCKET_NAME: props.configBucket.bucketName,
        CONFIG_PATHS_PARAM: props.ssmParameterPrefix + "/CategorizationConfig",
        BEDROCK_MODEL_ID: "us.amazon.nova-micro-v1:0",
      },
      timeout: props.timeout ? props.timeout : Duration.seconds(900),
      memorySize: 512,
      architecture: lambda.Architecture.X86_64,
    });

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          Stack.of(this).formatArn({
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            service: "ssm",
            resource: "parameter",
            resourceName:
              props.ssmParameterPrefix.slice(1) + "/CategorizationConfig",
          }),
        ],
      }),
    );

    this.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:ListFoundationModels", "bedrock:InvokeModel"],
        resources: [
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "us.anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "us.amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "us-*",
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "us-*",
          }),
        ],
      }),
    );

    this.role?.addManagedPolicy(props.wordEmbeddingsPolicy);

    props.configBucket.grantRead(this);

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "This role uses a wildcard resource to allow access to all objects in a specific bucket and use Bedrock models.",
        },
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Using the AWSLambdaBasicExecutionRole Managed Policy to expedite development. Replace on Production environment (Path to Production)",
        },
      ],
      true,
    );
  }
}
