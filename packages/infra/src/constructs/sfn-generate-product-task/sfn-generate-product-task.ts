/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import path from "path";
import {
  ArnFormat,
  aws_ecr_assets as ecr_assets,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  Duration,
  Stack,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

/**
 * Options for the GenerateProductFunction construct
 */
export interface GenerateProductFunctionProps {
  imagesBucket: s3.IBucket;
  /** The image keys the function may read, such as "uploads/*". */
  imageKeyPattern: string;
  /** The handler; the default is the batch workflow step. */
  cmd?: string[];
  timeout?: Duration;
  appConfigApplicationId?: string;
  appConfigEnvironmentId?: string;
  appConfigConfigurationProfileId?: string;
}

/**
 * Lambda function that generates a product title and description from images, for the API and the batch workflow.
 */
export class GenerateProductFunction extends lambda.DockerImageFunction {
  constructor(
    scope: Construct,
    id: string,
    props: GenerateProductFunctionProps,
  ) {
    super(scope, id, {
      code: lambda.DockerImageCode.fromImageAsset(
        path.resolve(__dirname, "../../../..", "smart-product-onboarding"),
        {
          platform: ecr_assets.Platform.LINUX_ARM64,
          cmd: props.cmd ?? [
            "amzn_smart_product_onboarding_product_categorization.aws_lambda.generate_product.handler",
          ],
        },
      ),
      environment: {
        IMAGE_BUCKET: props.imagesBucket.bucketName,
        BEDROCK_MODEL_ID: "global.anthropic.claude-haiku-5-5",
        ...(props.appConfigApplicationId && {
          APPCONFIG_APPLICATION_ID: props.appConfigApplicationId,
        }),
        ...(props.appConfigEnvironmentId && {
          APPCONFIG_ENVIRONMENT_ID: props.appConfigEnvironmentId,
        }),
        ...(props.appConfigConfigurationProfileId && {
          APPCONFIG_CONFIGURATION_PROFILE_ID:
            props.appConfigConfigurationProfileId,
        }),
      },
      tracing: lambda.Tracing.ACTIVE,
      timeout: props.timeout ?? Duration.seconds(60),
      memorySize: 512,
      architecture: lambda.Architecture.ARM_64,
    });

    // Converse only: the function never streams.
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: [
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "*.anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "*.amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "*",
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "*",
          }),
        ],
      }),
    );

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [props.imagesBucket.arnForObjects(props.imageKeyPattern)],
      }),
    );

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Using the AWSLambdaBasicExecutionRole Managed Policy to expedite development. Replace on Production environment (Path to Production)",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "The models are chosen at runtime, and the images are read from a key prefix of a specific bucket.",
        },
      ],
      true,
    );
  }
}

/**
 * Options for the SfnGenerateProduct construct
 */
export interface SfnGenerateProductProps {
  imagesBucket: s3.IBucket;
  appConfigApplicationId?: string;
  appConfigEnvironmentId?: string;
  appConfigConfigurationProfileId?: string;
}

export class SfnGenerateProduct extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];
  public readonly function: lambda.IFunction;

  constructor(scope: Construct, id: string, props: SfnGenerateProductProps) {
    super(scope, id);

    // The workflow reads the images under its execution's prefix.
    this.function = new GenerateProductFunction(this, "Function", {
      imagesBucket: props.imagesBucket,
      imageKeyPattern: "*",
      appConfigApplicationId: props.appConfigApplicationId,
      appConfigEnvironmentId: props.appConfigEnvironmentId,
      appConfigConfigurationProfileId: props.appConfigConfigurationProfileId,
    });

    const task = new tasks.LambdaInvoke(this, id, {
      lambdaFunction: this.function,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({
        prefix: sfn.JsonPath.stringAt("$.images_prefix"),
        images: sfn.JsonPath.stringAt("$.product.images"),
        metadata: sfn.JsonPath.stringAt("$.product.metadata"),
      }),
      resultPath: "$.product",
    });

    task.addRetry({
      errors: ["RetryableError", "ModelResponseError"],
      backoffRate: 2,
      maxAttempts: 2,
    });

    task.addRetry({
      errors: ["RateLimitError"],
      backoffRate: 2,
      interval: Duration.seconds(15),
      maxAttempts: 10,
      maxDelay: Duration.seconds(120),
      jitterStrategy: sfn.JitterType.FULL,
    });

    this.startState = task;
    this.endStates = task.endStates;
  }
}
