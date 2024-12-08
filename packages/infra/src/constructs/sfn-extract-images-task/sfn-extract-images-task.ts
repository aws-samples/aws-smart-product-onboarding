/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import path from "path";
import {
  aws_ecr_assets as ecr_assets,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  Duration,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface ExtractImagesTaskFunctionProps {
  imagesBucket: s3.IBucket;
}

export class ExtractImagesTaskFunction extends lambda.DockerImageFunction {
  constructor(
    scope: Construct,
    id: string,
    props: ExtractImagesTaskFunctionProps,
  ) {
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
          platform: ecr_assets.Platform.LINUX_ARM64,
          cmd: [
            "amzn_smart_product_onboarding_product_categorization.aws_lambda.images_extractor.handler",
          ],
        },
      ),
      environment: {
        IMAGES_BUCKET_NAME: props.imagesBucket.bucketName,
      },
      timeout: Duration.seconds(600),
      memorySize: 768,
      architecture: lambda.Architecture.ARM_64,
    });

    props.imagesBucket.grantReadWrite(this);

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "This role uses a wildcard resource to allow access to all objects in a specific bucket.",
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

export interface ExtractImagesTaskProps {
  imagesBucket: s3.IBucket;
}

export class ExtractImagesTask extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];
  public readonly function: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ExtractImagesTaskProps) {
    super(scope, id);

    this.function = new ExtractImagesTaskFunction(this, "Function", {
      imagesBucket: props.imagesBucket,
    });

    const task = new tasks.LambdaInvoke(this, id, {
      lambdaFunction: this.function,
      payloadResponseOnly: true,
      payload: sfn.TaskInput.fromObject({
        prefix: sfn.JsonPath.executionName,
        images_key: sfn.JsonPath.stringAt("$.images_key"),
      }),
      resultPath: "$.images",
    });

    task.addRetry({
      errors: [sfn.Errors.ALL],
      backoffRate: 2,
      maxAttempts: 2,
    });

    this.startState = task;
    this.endStates = task.endStates;
  }
}
