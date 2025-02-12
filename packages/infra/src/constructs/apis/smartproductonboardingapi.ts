/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { UserIdentity } from "@aws/pdk/identity";
import { Authorizers, Integrations } from "@aws/pdk/type-safe-api";
import {
  Api,
  CreateBatchExecutionFunction,
  DownloadFileFunction,
  GenerateProductFunction,
  GetBatchExecutionFunction,
  ListBatchExecutionsFunction,
  UploadFileFunction,
} from "@aws-samples/smart-product-onboarding-api-typescript-infra";
import {
  ArnFormat,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  Duration,
  Stack,
} from "aws-cdk-lib";
import { EndpointType, ResponseType } from "aws-cdk-lib/aws-apigateway";
import { Effect, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { ApiPersistence } from "../api-persistence/api-persistence";
import { AttributeExtractionTaskFunction } from "../sfn-attributes-task/sfn-attributes-task";
import { ClassificationTaskFunction } from "../sfn-classification-task/sfn-classification-task";
import { MetaclassTaskFunction } from "../sfn-metaclass-task/sfn-metaclass-task";

/**
 * Api construct props.
 */
export interface SmartProductOnboardingAPIProps {
  /**
   * Instance of the UserIdentity.
   */
  readonly userIdentity: UserIdentity;
  readonly inputBucket: s3.IBucket;
  readonly outputBucket: s3.IBucket;
  readonly persistenceLayer: ApiPersistence;
  readonly batchCategorizationMachine: sfn.IStateMachine;
  readonly ssmParameterPrefix: string;
  readonly configurationBucket: s3.IBucket;
  readonly wordEmbeddingsPolicy: iam.IManagedPolicy;
}

/**
 * Infrastructure construct to deploy a Type Safe API.
 */
export class SmartProductOnboardingAPI extends Construct {
  /**
   * API instance
   */
  public readonly api: Api;

  constructor(
    scope: Construct,
    id: string,
    props: SmartProductOnboardingAPIProps,
  ) {
    super(scope, id);

    const metaclassFunction = new MetaclassTaskFunction(
      this,
      "MetaclassFunction",
      {
        ssmParameterPrefix: props.ssmParameterPrefix,
        configBucket: props.configurationBucket,
        wordEmbeddingsPolicy: props.wordEmbeddingsPolicy,
        cmd: [
          "amzn_smart_product_onboarding_metaclasses.aws_lambda_apigw.handler",
        ],
        timeout: Duration.seconds(29),
      },
    );

    const categorizeProductFunction = new ClassificationTaskFunction(
      this,
      "CategorizeProductFunction",
      {
        ssmParameterPrefix: props.ssmParameterPrefix,
        configBucket: props.configurationBucket,
        cmd: [
          "amzn_smart_product_onboarding_product_categorization.aws_lambda.categorization_apigw.handler",
        ],
        timeout: Duration.seconds(29),
      },
    );

    const extractAttributesFunction = new AttributeExtractionTaskFunction(
      this,
      "ExtractAttributesFunction",
      {
        configBucket: props.configurationBucket,
        cmd: [
          "amzn_smart_product_onboarding_product_categorization.aws_lambda.attribute_extraction_apigw.handler",
        ],
        timeout: Duration.seconds(29),
      },
    );

    const generateProductFunction = new GenerateProductFunction(
      this,
      "GenerateProductFunction",
      {
        environment: {
          IMAGE_BUCKET: props.inputBucket.bucketName,
          BEDROCK_MODEL_ID: "us.anthropic.claude-3-haiku-20240307-v1:0",
        },
        memorySize: 512,
        architecture: lambda.Architecture.ARM_64,
      },
    );
    props.inputBucket.grantRead(generateProductFunction);

    generateProductFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "us.anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "us.amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "us-*",
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "us-*",
          }),
        ],
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
        ],
      }),
    );

    NagSuppressions.addResourceSuppressions(
      generateProductFunction,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "Lambda Basic Execution Managed Policy used to expedite development.",
        },
        {
          id: "AwsSolutions-IAM5",
          reason:
            "This policy has wildcards to read and objects from a specific S3 bucket.",
        },
      ],
      true,
    );

    const createBatchExecutionFunction = new CreateBatchExecutionFunction(
      this,
      "CreateBatchExecutionFunction",
      {
        environment: {
          INPUT_BUCKET_NAME: props.inputBucket.bucketName,
          CATEGORIZATION_MACHINE:
            props.batchCategorizationMachine.stateMachineArn,
          SESSION_TABLE: props.persistenceLayer.sessionTable.tableName,
        },
      },
    );
    props.inputBucket.grantRead(createBatchExecutionFunction);
    props.batchCategorizationMachine.grantStartExecution(
      createBatchExecutionFunction,
    );
    props.persistenceLayer.sessionTable.grantReadWriteData(
      createBatchExecutionFunction,
    );

    const listBatchExecutionsFunction = new ListBatchExecutionsFunction(
      this,
      "ListBatchExecutionsFunction",
      {
        environment: {
          SESSION_TABLE: props.persistenceLayer.sessionTable.tableName,
          CREATED_AT_INDEX_NAME: props.persistenceLayer.createdAtIndexName,
        },
      },
    );
    props.persistenceLayer.sessionTable.grantReadData(
      listBatchExecutionsFunction,
    );

    const getBatchExecutionFunction = new GetBatchExecutionFunction(
      this,
      "GetBatchExecutionFunction",
      {
        environment: {
          SESSION_TABLE: props.persistenceLayer.sessionTable.tableName,
        },
      },
    );
    props.persistenceLayer.sessionTable.grantReadData(
      getBatchExecutionFunction,
    );
    props.batchCategorizationMachine.grantRead(getBatchExecutionFunction);

    const downloadFileFunction = new DownloadFileFunction(
      this,
      "DownloadFileFunction",
      {
        environment: {
          OUTPUT_BUCKET_NAME: props.outputBucket.bucketName,
        },
      },
    );
    props.outputBucket.grantRead(downloadFileFunction);

    const uploadFileFunction = new UploadFileFunction(
      this,
      "UploadFileFunction",
      {
        environment: {
          INPUT_BUCKET_NAME: props.inputBucket.bucketName,
        },
      },
    );
    props.inputBucket.grantWrite(uploadFileFunction, "uploads/*");

    for (const fn of [
      createBatchExecutionFunction,
      listBatchExecutionsFunction,
      getBatchExecutionFunction,
      uploadFileFunction,
      downloadFileFunction,
    ]) {
      NagSuppressions.addResourceSuppressions(
        fn,
        [
          {
            id: "AwsSolutions-IAM4",
            reason:
              "Lambda Basic Execution Managed Policy used to expedite development.",
          },
          {
            id: "AwsSolutions-IAM5",
            reason:
              "This policy has wildcards to read and objects from a specific S3 bucket.",
          },
        ],
        true,
      );
    }

    this.api = new Api(this, id, {
      defaultAuthorizer: Authorizers.cognito({
        authorizerId: "CognitoUserPool",
        userPools: [props.userIdentity.userPool],
      }),
      endpointTypes: [EndpointType.REGIONAL],
      corsOptions: {
        allowOrigins: ["http://localhost:3000"],
        allowMethods: ["GET", "POST"],
      },
      integrations: {
        metaclass: {
          integration: Integrations.lambda(metaclassFunction),
        },
        categorizeProduct: {
          integration: Integrations.lambda(categorizeProductFunction),
        },
        extractAttributes: {
          integration: Integrations.lambda(extractAttributesFunction),
        },

        generateProduct: {
          integration: Integrations.lambda(generateProductFunction),
        },
        createBatchExecution: {
          integration: Integrations.lambda(createBatchExecutionFunction),
        },
        listBatchExecutions: {
          integration: Integrations.lambda(listBatchExecutionsFunction),
        },
        getBatchExecution: {
          integration: Integrations.lambda(getBatchExecutionFunction),
        },
        downloadFile: {
          integration: Integrations.lambda(downloadFileFunction),
        },
        uploadFile: {
          integration: Integrations.lambda(uploadFileFunction),
        },
      },
      policy: new PolicyDocument({}),
    });
    this.api.api.addGatewayResponse("Default4XX", {
      responseHeaders: {
        "Access-Control-Allow-Origin": "'http://localhost:3000'",
        "Access-Control-Allow-Headers": "'*'",
      },
      type: ResponseType.DEFAULT_4XX,
    });
    this.api.api.addGatewayResponse("Default5XX", {
      responseHeaders: {
        "Access-Control-Allow-Origin": "'http://localhost:3000'",
        "Access-Control-Allow-Headers": "'*'",
      },
      type: ResponseType.DEFAULT_5XX,
    });

    NagSuppressions.addResourceSuppressions(
      this.api,
      [
        {
          id: "AwsSolutions-L1",
          reason: "Lambda runtime versions managed upstream in PDK.",
        },
      ],
      true,
    );

    for (const resource of [
      generateProductFunction,
      createBatchExecutionFunction,
      listBatchExecutionsFunction,
      getBatchExecutionFunction,
      downloadFileFunction,
      uploadFileFunction,
    ]) {
      NagSuppressions.addResourceSuppressions(
        resource,
        [
          {
            id: "AwsSolutions-IAM5",
            reason:
              "This role uses wildcards to allow retrieval of Step Functions execution results and other resources to expedite development. Consider further limiting on Production environment (Path to Production)",
          },
          {
            id: "AwsSolutions-IAM4",
            reason:
              "Using the AWSLambdaBasicExecutionRole Managed Policy to expedite development. Replace on Production environment (Path to Production)",
          },
        ],
        true,
      );
    }
  }
}
