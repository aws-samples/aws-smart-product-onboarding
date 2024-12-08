/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import {
  aws_dynamodb as ddb,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface SfnPopulateOutputTaskProps {
  sessionsTable: ddb.ITable;
}

export class SfnPopulateOutputTask extends sfn.StateMachineFragment {
  public readonly startState: tasks.DynamoUpdateItem;
  public readonly endStates: sfn.INextable[];

  constructor(scope: Construct, id: string, props: SfnPopulateOutputTaskProps) {
    super(scope, id);

    const updateItemTask = new tasks.DynamoUpdateItem(this, "UpdateOutputKey", {
      table: props.sessionsTable,
      key: {
        session_id: tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.session_id"),
        ),
      },
      updateExpression: "SET #outputKey = :outputKey",
      expressionAttributeNames: {
        "#outputKey": "outputKey",
        "#status": "status",
      },
      expressionAttributeValues: {
        ":outputKey": tasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt("$.output.Key"),
        ),
        ":success": tasks.DynamoAttributeValue.fromString("SUCCESS"),
      },
      conditionExpression: "#status = :success",
    });

    this.startState = updateItemTask;
    this.endStates = updateItemTask.endStates;
  }
}
