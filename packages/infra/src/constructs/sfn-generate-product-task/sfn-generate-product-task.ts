/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import path from "path";
import {
  ArnFormat,
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
 * Options for the SfnGenerateProductFunction construct
 */
export interface SfnGenerateProductFunctionProps
  extends Omit<lambda.FunctionProps, "code" | "handler" | "runtime"> {}

/**
 * Lambda function construct which points to the typescript implementation of GenerateProductSFN
 */
export class SfnGenerateProductFunction extends lambda.Function {
  constructor(
    scope: Construct,
    id: string,
    props?: SfnGenerateProductFunctionProps,
  ) {
    super(scope, id, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(
        path.resolve(
          __dirname,
          "../../../..",
          "api/handlers/typescript/dist/lambda",
          "generate-product-sfn",
        ),
      ),
      tracing: lambda.Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      ...props,
    });

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
  }
}

/**
 * Options for the SfnGenerateProduct construct
 */
export interface SfnGenerateProductProps {
  imagesBucket: s3.IBucket;
}

export class SfnGenerateProduct extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];
  public readonly function: lambda.IFunction;

  constructor(scope: Construct, id: string, props: SfnGenerateProductProps) {
    super(scope, id);

    this.function = new SfnGenerateProductFunction(this, "Function", {
      timeout: Duration.seconds(60),
      memorySize: 512,
      architecture: lambda.Architecture.ARM_64,
      environment: {
        IMAGE_BUCKET: props.imagesBucket.bucketName,
        BEDROCK_MODEL_ID: "us.anthropic.claude-3-haiku-20240307-v1:0",
      },
    });

    props.imagesBucket.grantRead(this.function);

    NagSuppressions.addResourceSuppressions(
      this.function,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Using the AWSLambdaBasicExecutionRole Managed Policy to expedite development. Replace on Production environment (Path to Production)",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "This role needs access to any object in a specific bucket.",
        },
      ],
      true,
    );

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
      errors: ["RetryableError"],
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
