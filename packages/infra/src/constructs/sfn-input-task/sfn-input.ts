/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
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
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(60),
      memorySize: 128,
    });

    NagSuppressions.addResourceSuppressions(
      this.inputFunction,
      [
        {
          id: "AwsSolutions-L1",
          reason:
            "Runtime pinned to Python 3.13 / Node.js 22 to match the bundled dependencies and the PDK-generated API constructs. cdk-nag flags anything below the newest runtime, which is currently a public preview (Python 3.15, Node.js 26). Upgrade runtimes together with the build images.",
        },
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
