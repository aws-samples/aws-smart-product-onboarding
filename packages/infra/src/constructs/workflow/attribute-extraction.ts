/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import {
  aws_stepfunctions as sfn,
  aws_lambda as lambda,
  aws_stepfunctions_tasks as tasks,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AttributeExtractionTaskProps {
  readonly attributeExtractionTaskFunction: lambda.IFunction;
}

export class AttributeExtractionTask extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];

  constructor(
    scope: Construct,
    id: string,
    props: AttributeExtractionTaskProps,
  ) {
    super(scope, id);

    const attributeExtractionTask = new tasks.LambdaInvoke(
      this,
      "AttributeExtractionTask",
      {
        resultPath: "$.attributes",
        payload: sfn.TaskInput.fromObject({
          product: sfn.JsonPath.objectAt("$.product"),
          category: sfn.JsonPath.objectAt("$.classification"),
        }),
        payloadResponseOnly: true,
        lambdaFunction: props.attributeExtractionTaskFunction,
      },
    );

    attributeExtractionTask.addRetry({
      errors: ["RetryableError", "ModelResponseError"],
      backoffRate: 2,
      maxAttempts: 2,
    });

    attributeExtractionTask.addRetry({
      errors: ["RateLimitError"],
      backoffRate: 2,
      interval: Duration.seconds(15),
      maxAttempts: 10,
      maxDelay: Duration.seconds(120),
      jitterStrategy: sfn.JitterType.FULL,
    });

    attributeExtractionTask.addRetry({
      errors: ["Lambda.TooManyRequestsException"],
      backoffRate: 2,
      maxAttempts: 99999999,
      maxDelay: Duration.seconds(30),
      jitterStrategy: sfn.JitterType.FULL,
    });

    this.startState = attributeExtractionTask.startState;
    this.endStates = attributeExtractionTask.endStates;
  }
}
