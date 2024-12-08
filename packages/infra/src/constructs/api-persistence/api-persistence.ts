/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { aws_dynamodb as dynamodb, RemovalPolicy } from "aws-cdk-lib";

import { Construct } from "constructs";

export class ApiPersistence extends Construct {
  public readonly sessionTable: dynamodb.TableV2;
  public readonly createdAtIndexName = "sessionsByCreatedAtDate";
  public readonly updatedAtIndexName = "sessionsByUpdatedAtDate";

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.sessionTable = new dynamodb.TableV2(this, "SessionTable", {
      partitionKey: { name: "session_id", type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryptionV2.dynamoOwnedKey(),
    });

    this.sessionTable.addGlobalSecondaryIndex({
      indexName: this.createdAtIndexName,
      partitionKey: {
        name: "type",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "created_at",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.sessionTable.addGlobalSecondaryIndex({
      indexName: this.updatedAtIndexName,
      partitionKey: {
        name: "type",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "updated_at",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
