/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Authorizers, Integrations } from "@aws/pdk/type-safe-api";
import {
  Api,
  GenerateProductFunction,
} from "@aws-samples/smart-product-onboarding-api-typescript-infra";
import {
  ArnFormat,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_stepfunctions as sfn,
  Duration,
  RemovalPolicy,
  Stack,
} from "aws-cdk-lib";
import {
  AccessLogFormat,
  EndpointType,
  LogGroupLogDestination,
  MethodLoggingLevel,
  ResponseType,
} from "aws-cdk-lib/aws-apigateway";
import { Effect, PolicyDocument, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import {
  CreateBatchExecutionFunction,
  DownloadFileFunction,
  GetBatchExecutionFunction,
  ListBatchExecutionsFunction,
  UploadFileFunction,
} from "./api-handler-functions";
import { ApiPersistence } from "../api-persistence/api-persistence";
import { AttributeExtractionTaskFunction } from "../sfn-attributes-task/sfn-attributes-task";
import { ClassificationTaskFunction } from "../sfn-classification-task/sfn-classification-task";
import { MetaclassTaskFunction } from "../sfn-metaclass-task/sfn-metaclass-task";
import { UserIdentity } from "../user-identity/user-identity";

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
  readonly corsOrigin: string;
  readonly appConfigApplicationId?: string;
  readonly appConfigEnvironmentId?: string;
  readonly appConfigConfigurationProfileId?: string;
}

/**
 * Infrastructure construct to deploy a Type Safe API.
 */
export class SmartProductOnboardingAPI extends Construct {
  /**
   * API instance
   */
  public readonly api: Api;

  public readonly metaclassFunction: MetaclassTaskFunction;
  public readonly categorizeProductFunction: ClassificationTaskFunction;
  public readonly extractAttributesFunction: AttributeExtractionTaskFunction;
  public readonly generateProductFunction: lambda.IFunction;

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
        appConfigApplicationId: props.appConfigApplicationId,
        appConfigEnvironmentId: props.appConfigEnvironmentId,
        appConfigConfigurationProfileId: props.appConfigConfigurationProfileId,
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
        appConfigApplicationId: props.appConfigApplicationId,
        appConfigEnvironmentId: props.appConfigEnvironmentId,
        appConfigConfigurationProfileId: props.appConfigConfigurationProfileId,
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
        appConfigApplicationId: props.appConfigApplicationId,
        appConfigEnvironmentId: props.appConfigEnvironmentId,
        appConfigConfigurationProfileId: props.appConfigConfigurationProfileId,
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
          BEDROCK_MODEL_ID: "global.anthropic.claude-haiku-5-5",
          ...(props.appConfigApplicationId && {
            APPCONFIG_APPLICATION_ID: props.appConfigApplicationId,
          }),
          ...(props.appConfigEnvironmentId && {
            APPCONFIG_ENVIRONMENT_ID: props.appConfigEnvironmentId,
          }),
          ...(props.appConfigConfigurationProfileId && {
            APPCONFIG_CONFIGURATION_PROFILE_ID:
              props.appConfigConfigurationProfileId,
          }),
        },
        memorySize: 512,
        architecture: lambda.Architecture.ARM_64,
      },
    );
    props.inputBucket.grantRead(generateProductFunction);

    this.metaclassFunction = metaclassFunction;
    this.categorizeProductFunction = categorizeProductFunction;
    this.extractAttributesFunction = extractAttributesFunction;
    this.generateProductFunction = generateProductFunction;

    generateProductFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "*.anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "inference-profile",
            resourceName: "*.amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "anthropic.claude-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "*",
          }),
          Stack.of(this).formatArn({
            service: "bedrock",
            resource: "foundation-model",
            resourceName: "amazon.nova-*",
            arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
            account: "",
            region: "*",
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

    const accessLogs = new logs.LogGroup(this, "AccessLogs", {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.api = new Api(this, id, {
      defaultAuthorizer: Authorizers.cognito({
        authorizerId: "CognitoUserPool",
        userPools: [props.userIdentity.userPool],
      }),
      endpointTypes: [EndpointType.REGIONAL],
      corsOptions: {
        allowOrigins: [props.corsOrigin],
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
      // Matches the TypeSafeRestApi defaults field for field, with the log retention set explicitly.
      // The props spread replaces deployOptions as a whole, so every default field is restated here.
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogs),
        accessLogFormat: AccessLogFormat.clf(),
        loggingLevel: MethodLoggingLevel.INFO,
      },
    });
    // TypeSafeRestApi always creates its own "AccessLogs" group while building its defaults, even when
    // deployOptions is passed. Remove that unused group, and keep its logical ID on ours so existing
    // stacks update the log group in place instead of retaining an orphaned copy.
    this.api.node.tryRemoveChild("AccessLogs");
    (accessLogs.node.defaultChild as logs.CfnLogGroup).overrideLogicalId(
      "ApiAccessLogs02C2A02B",
    );
    this.api.api.addGatewayResponse("Default4XX", {
      responseHeaders: {
        "Access-Control-Allow-Origin": `'${props.corsOrigin}'`,
        "Access-Control-Allow-Headers": "'*'",
      },
      type: ResponseType.DEFAULT_4XX,
    });
    this.api.api.addGatewayResponse("Default5XX", {
      responseHeaders: {
        "Access-Control-Allow-Origin": `'${props.corsOrigin}'`,
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
            id: "AwsSolutions-L1",
            reason:
              resource === generateProductFunction
                ? "Uses the latest generally available Lambda runtime (Node.js 24). cdk-nag compares against the newest runtime defined in aws-cdk-lib, which is a public preview runtime (Node.js 26) not supported for production workloads."
                : "Uses the latest generally available Lambda runtime (Python 3.14). cdk-nag compares against the newest runtime defined in aws-cdk-lib, which is a public preview runtime (Python 3.15) not supported for production workloads.",
          },
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
