/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { PDKPipeline } from "@aws/pdk/pipeline";
import { Semaphore } from "@dontirun/state-machine-semaphore";
import {
  ArnFormat,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct, ConstructOrder } from "constructs";
import { AttributeExtractionTask } from "./attribute-extraction";
import { CategorizationTask } from "./categorization";
import { ErrorStatusFragment } from "../api-persistence/error-status";
import { createUpdateStatusTask } from "../api-persistence/update-status-task-builder";
import { SfnCsvResultwriter } from "../sfn-csv-resultwriter/sfn-csv-resultwriter";
import { ExtractImagesTask } from "../sfn-extract-images-task/sfn-extract-images-task";
import { SfnGenerateProduct } from "../sfn-generate-product-task/sfn-generate-product-task";
import { SfnInput } from "../sfn-input-task/sfn-input";
import { SfnPopulateOutputTask } from "../sfn-populate-outputkey-task/sfn-populate-outputkey-task";

export interface CategorizationWorkflowProps {
  inputBucket: s3.IBucket;
  configurationBucket: s3.IBucket;
  outputBucket: s3.IBucket;
  sessionTable: dynamodb.ITableV2;
  readonly metaclassTaskFunction: lambda.IFunction;
  readonly classificationTaskFunction: lambda.IFunction;
  readonly attributeExtractionTaskFunction: lambda.IFunction;
}

export class CategorizationWorkflow extends Construct {
  readonly stateMachine: sfn.StateMachine;

  constructor(
    scope: Construct,
    id: string,
    props: CategorizationWorkflowProps,
  ) {
    super(scope, id);
    const branchPrefix = PDKPipeline.getBranchPrefix({
      node: Stack.of(this).node,
    });

    const extractImagesTask = new ExtractImagesTask(this, "ExtractImagesTask", {
      imagesBucket: props.inputBucket,
    });

    const updateStatusWaiting = createUpdateStatusTask(
      this,
      "UpdateStatusWaiting",
      {
        sessionTable: props.sessionTable,
        status: "WAITING",
      },
    );

    const updateStatusRunning = createUpdateStatusTask(
      this,
      "UpdateStatusRunning",
      {
        sessionTable: props.sessionTable,
        status: "RUNNING",
      },
    );

    const updateStatusSuccess = createUpdateStatusTask(
      this,
      "UpdateStatusSuccess",
      {
        sessionTable: props.sessionTable,
        status: "SUCCESS",
      },
    );

    const updateStatusError = new ErrorStatusFragment(
      this,
      "UpdateStatusError",
      {
        sessionTable: props.sessionTable,
      },
    );

    const outputState = new sfn.Pass(this, "OutputState", {
      parameters: {
        title_new: sfn.JsonPath.stringAt("$.product.title"),
        description_new: sfn.JsonPath.stringAt("$.product.description"),
        category_new: sfn.JsonPath.stringAt(
          "$.classification.predicted_category_id",
        ),
        category_new_path: sfn.JsonPath.stringAt(
          "$.classification.predicted_category_name",
        ),
        category_new_explanation: sfn.JsonPath.stringAt(
          "$.classification.explanation",
        ),
        attributes: sfn.JsonPath.listAt("$.attributes"),
      },
    });

    const categorization = new CategorizationTask(this, "CategorizationTask", {
      metaclassTaskFunction: props.metaclassTaskFunction,
      classificationTaskFunction: props.classificationTaskFunction,
    });

    const attributeExtraction = new AttributeExtractionTask(
      this,
      "AttributeExtractionTask",
      {
        attributeExtractionTaskFunction: props.attributeExtractionTaskFunction,
      },
    );

    categorization.next(attributeExtraction).next(outputState);

    const generateProduct = new SfnGenerateProduct(
      this,
      "GenerateProductTask",
      {
        imagesBucket: props.inputBucket,
      },
    );

    generateProduct.next(categorization);

    const failState = new sfn.Fail(this, "Fail", {
      causePath: sfn.JsonPath.stringAt("$.error.Cause"),
      errorPath: sfn.JsonPath.stringAt("$.error.Error"),
    });

    const inputState = new SfnInput(this, "InputState");

    const doGenerateProduct = new sfn.Choice(this, "DoGenerateProduct?")
      .when(sfn.Condition.isPresent("$.product.images[0]"), generateProduct)
      .otherwise(categorization);

    inputState.next(doGenerateProduct);

    const mapOutput = "mapOutput";

    const categorizationMap = new sfn.DistributedMap(
      this,
      "CategorizationMap",
      {
        maxConcurrency: 20,
        mapExecutionType: sfn.StateMachineType.STANDARD,
        itemReader: new sfn.S3CsvItemReader({
          bucket: props.inputBucket,
          key: sfn.JsonPath.stringAt("$.detail.object.key"),
          csvHeaders: sfn.CsvHeaders.useFirstRow(),
        }),
        itemSelector: {
          images_prefix: sfn.JsonPath.executionName,
          input: sfn.JsonPath.objectAt("$$.Map.Item.Value"),
        },
        resultWriter: new sfn.ResultWriter({
          bucket: props.outputBucket,
          prefix: sfn.JsonPath.format(
            "sfnResults/{}/",
            sfn.JsonPath.stringAt("$.detail.object.key"),
          ),
        }),
        resultPath: "$." + mapOutput,
        toleratedFailurePercentage: 15,
      },
    );
    categorizationMap.itemProcessor(inputState);
    categorizationMap.addCatch(updateStatusError, {
      resultPath: "$.error",
    });

    const categorizationMapWithStatus =
      updateStatusRunning.next(categorizationMap);

    const csvReducer = new SfnCsvResultwriter(this, "CsvReducer", {
      resultBucket: props.outputBucket,
      mapOutput: mapOutput,
    });

    const updateOutputKey = new SfnPopulateOutputTask(this, "UpdateOutputKey", {
      sessionsTable: props.sessionTable,
    });

    csvReducer.next(updateStatusSuccess).next(updateOutputKey);

    const checkError = new sfn.Choice(this, "CheckError")
      .when(sfn.Condition.isPresent("$.error"), failState)
      .otherwise(csvReducer);

    const machineName = `${branchPrefix}BatchProductOnboarding`;

    // Make sure only one instance of the workflow runs at a time to reduce Bedrock throttling
    const semaphore = new Semaphore(this, "CategorizationSemaphore", {
      lockName: machineName,
      limit: 1,
      job: categorizationMapWithStatus,
      nextState: checkError,
    });
    updateStatusError.next(
      semaphore.node
        .findAll(ConstructOrder.POSTORDER)
        .find(
          (s) =>
            s instanceof tasks.DynamoUpdateItem && s.id.includes("Release"),
        ) as tasks.DynamoUpdateItem,
    );

    NagSuppressions.addResourceSuppressionsByPath(
      Stack.of(this),
      Stack.of(this).node.path +
        "/StateMachineSempahoreTable920751a65a584e8ab7583460f6db686a",
      [
        {
          id: "AwsSolutions-DDB3",
          reason:
            "This DynamoDB table is for ephemeral data so PITR is not needed",
        },
      ],
      true,
    );

    const extractImagesChoice = new sfn.Choice(this, "DoExtractImages?")
      .when(sfn.Condition.isPresent("$.images_key"), extractImagesTask)
      .otherwise(updateStatusWaiting);

    extractImagesTask.next(updateStatusWaiting);

    updateStatusWaiting.next(semaphore);

    sfn.State.findReachableStates(updateStatusWaiting, {
      includeErrorHandlers: true,
    }).forEach((s) => {
      if (s instanceof sfn.TaskStateBase && s.stateId !== "UpdateStatusError") {
        s.addCatch(updateStatusError, {
          resultPath: "$.error",
        });
      }
    });

    this.stateMachine = new sfn.StateMachine(this, "BatchCategorization", {
      stateMachineName: machineName,
      definitionBody: sfn.DefinitionBody.fromChainable(extractImagesChoice),
      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(
          this,
          branchPrefix + "ProductCategorization",
          {
            removalPolicy: RemovalPolicy.DESTROY,
          },
        ),
        level: sfn.LogLevel.ALL,
      },
    });

    props.inputBucket.grantRead(this.stateMachine);
    props.configurationBucket.grantRead(this.stateMachine);
    props.outputBucket.grantReadWrite(this.stateMachine);
    props.sessionTable.grantReadWriteData(this.stateMachine);

    this.stateMachine.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["states:StartExecution"],
        resources: [
          Stack.of(this).formatArn({
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
            service: "states",
            resource: "stateMachine",
            resourceName: machineName,
          }),
        ],
      }),
    );

    NagSuppressions.addResourceSuppressions(
      this.stateMachine,
      [
        {
          id: "AwsSolutions-IAM5",
          reason:
            "This role uses a wildcard resource to allow access to all objects in specific buckets.",
        },
      ],
      true,
    );
  }
}
