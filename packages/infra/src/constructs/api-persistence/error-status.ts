/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  aws_dynamodb as dynamodb,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface ErrorStatusFragmentProps {
  /**
   * The session table with status.
   */
  readonly sessionTable: dynamodb.ITableV2;
}

export class ErrorStatusFragment extends sfn.StateMachineFragment {
  public readonly startState: sfn.State;
  public readonly endStates: sfn.INextable[];

  constructor(scope: Construct, id: string, props: ErrorStatusFragmentProps) {
    super(scope, id);

    const updateStatusError = new tasks.DynamoUpdateItem(this, id, {
      table: props.sessionTable,
      key: {
        session_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.session_id"),
        ),
      },
      updateExpression: "SET #st = :st, #e = :e, #u = :u, #d = :d",
      expressionAttributeNames: {
        "#st": "status",
        "#e": "error",
        "#u": "updated_at",
        "#d": "date",
      },
      expressionAttributeValues: {
        ":st": tasks.DynamoAttributeValue.fromString("ERROR"),
        ":e": tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.error.Error"),
        ),
        ":u": tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$$.State.EnteredTime"),
        ),
        ":d": tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.arrayGetItem(
            sfn.JsonPath.stringSplit(
              sfn.JsonPath.stringAt("$$.State.EnteredTime"),
              "T",
            ),
            0,
          ),
        ),
      },
      resultPath: sfn.JsonPath.DISCARD,
    });

    const errorPass = new sfn.Pass(this, "Error Setting Error");
    updateStatusError.addCatch(errorPass);

    this.startState = updateStatusError;
    this.endStates = [...updateStatusError.endStates, errorPass];
  }
}
