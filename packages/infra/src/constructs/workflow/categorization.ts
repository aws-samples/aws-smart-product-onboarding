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

export interface CategorizationTaskProps {
  readonly metaclassTaskFunction: lambda.IFunction;
  readonly classificationTaskFunction: lambda.IFunction;
}

export class CategorizationTask extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];

  constructor(scope: Construct, id: string, props: CategorizationTaskProps) {
    super(scope, id);

    const setDemo = new sfn.Pass(this, "SetDemo", {
      resultPath: "$.demo",
      result: sfn.Result.fromBoolean(false),
    });

    const hasDemo = new sfn.Choice(this, "HasDemo");

    const metaclassTask = new tasks.LambdaInvoke(this, "MetaclassTask", {
      resultPath: "$.metaclass",
      payload: sfn.TaskInput.fromObject({
        product: sfn.JsonPath.objectAt("$.product"),
        demo: sfn.JsonPath.objectAt("$.demo"),
      }),
      payloadResponseOnly: true,
      lambdaFunction: props.metaclassTaskFunction,
    });

    const classificationTask = new tasks.LambdaInvoke(
      this,
      "ClassificationTask",
      {
        resultPath: "$.classification",
        payload: sfn.TaskInput.fromObject({
          product: sfn.JsonPath.objectAt("$.product"),
          metaclass: sfn.JsonPath.objectAt("$.metaclass"),
          demo: sfn.JsonPath.objectAt("$.demo"),
        }),
        payloadResponseOnly: true,
        lambdaFunction: props.classificationTaskFunction,
      },
    );
    classificationTask.addRetry({
      errors: ["RetryableError", "ModelResponseError"],
      backoffRate: 2,
      maxAttempts: 2,
    });
    classificationTask.addRetry({
      errors: ["RateLimitError"],
      backoffRate: 2,
      interval: Duration.seconds(15),
      maxAttempts: 10,
      maxDelay: Duration.seconds(120),
      jitterStrategy: sfn.JitterType.FULL,
    });
    classificationTask.addRetry({
      errors: ["Lambda.TooManyRequestsException"],
      backoffRate: 2,
      maxAttempts: 99999999,
      maxDelay: Duration.seconds(30),
      jitterStrategy: sfn.JitterType.FULL,
    });

    hasDemo
      .when(sfn.Condition.isNotPresent("$.demo"), setDemo)
      .otherwise(metaclassTask);
    setDemo.next(metaclassTask);
    metaclassTask.next(classificationTask);

    this.startState = hasDemo.startState;
    this.endStates = classificationTask.endStates;
  }
}
