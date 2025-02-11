/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";
import {
  aws_lambda as lambda,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  Duration,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

export class SfnInput extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];
  public readonly inputFunction: lambda.IFunction;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.inputFunction = new PythonFunction(this, "InputFunction", {
      entry: __dirname + "/lambdas/input",
      index: "input.py",
      runtime: lambda.Runtime.PYTHON_3_13,
      timeout: Duration.seconds(60),
      memorySize: 128,
    });

    NagSuppressions.addResourceSuppressions(
      this.inputFunction,
      [
        // {
        //   id: "AwsSolutions-IAM5",
        //   reason:
        //     "Certain roles will use wildcards to expedite development. Replace on Production environment (Path to Production)",
        // },
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Using the AWSLambdaBasicExecutionRole Managed Policy to expedite development. Replace on Production environment (Path to Production)",
        },
      ],
      true,
    );

    const inputTask = new tasks.LambdaInvoke(this, "InputLambdaTask", {
      lambdaFunction: this.inputFunction,
      payloadResponseOnly: true,
      inputPath: "$.input",
      resultPath: "$.product",
    });

    this.startState = inputTask;
    this.endStates = inputTask.endStates;
  }
}
