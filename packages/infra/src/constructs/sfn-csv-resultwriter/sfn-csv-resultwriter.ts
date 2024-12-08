/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import {
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  Duration,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export interface SfnCsvResultwriterProps {
  resultBucket: s3.IBucket;
  mapOutput: string;
}

export class SfnCsvResultwriter extends sfn.StateMachineFragment {
  public readonly startState: tasks.LambdaInvoke;
  public readonly endStates: sfn.INextable[];

  constructor(scope: Construct, id: string, props: SfnCsvResultwriterProps) {
    super(scope, id);

    const writerFunction = new PythonFunction(this, "CSVResultWriterFunction", {
      entry: __dirname + "/lambdas/csv_resultwriter",
      index: "csv_resultwriter.py",
      runtime: lambda.Runtime.PYTHON_3_12,
      environment: {
        RESULT_BUCKET: props.resultBucket.bucketName,
        RESULT_PREFIX: "results/",
      },
      timeout: Duration.seconds(60),
      memorySize: 256,
    });

    props.resultBucket.grantReadWrite(writerFunction);

    NagSuppressions.addResourceSuppressions(
      writerFunction,
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

    const writerTask = new tasks.LambdaInvoke(
      this,
      "CSVResultWriterLambdaTask",
      {
        lambdaFunction: writerFunction,
        payload: sfn.TaskInput.fromObject({
          inputKey: sfn.JsonPath.stringAt("$.detail.object.key"),
          ResultWriterDetails: sfn.JsonPath.objectAt(
            "$." + props.mapOutput + ".ResultWriterDetails",
          ),
        }),
        payloadResponseOnly: true,
        resultPath: "$.output",
      },
    );

    this.startState = writerTask;
    this.endStates = writerTask.endStates;
  }
}
