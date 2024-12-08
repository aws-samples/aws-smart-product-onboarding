/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { BatchExecutionStatus } from "@aws-samples/smart-product-onboarding-api-typescript-runtime";
import {
  aws_dynamodb as dynamodb,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface CreateUpdateStatusTaskProps {
  readonly sessionTable: dynamodb.ITableV2;
  readonly status: BatchExecutionStatus;
}

export function createUpdateStatusTask(
  scope: Construct,
  id: string,
  props: CreateUpdateStatusTaskProps,
): sfn.TaskStateBase {
  return new tasks.DynamoUpdateItem(scope, id, {
    table: props.sessionTable,
    key: {
      session_id: tasks.DynamoAttributeValue.fromString(
        sfn.JsonPath.stringAt("$.session_id"),
      ),
    },
    updateExpression: "SET #st = :st, #u = :u, #d = :d REMOVE #er",
    expressionAttributeNames: {
      "#st": "status",
      "#u": "updated_at",
      "#er": "error",
      "#d": "date",
    },
    expressionAttributeValues: {
      ":st": tasks.DynamoAttributeValue.fromString(props.status),
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
}
