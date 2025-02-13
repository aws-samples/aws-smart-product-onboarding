/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

import { UserIdentity } from "@aws/pdk/identity";
import { PDKPipeline } from "@aws/pdk/pipeline";
import {
  aws_cognito as cognito,
  aws_iam as iam,
  aws_s3 as s3,
  aws_ssm as ssm,
  CfnOutput,
  Duration,
  Stack,
  StackProps,
} from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { ApiPersistence } from "../constructs/api-persistence/api-persistence";
import { SmartProductOnboardingAPI } from "../constructs/apis/smartproductonboardingapi";
import { SecureBucket } from "../constructs/secure-bucket";
import { AttributeExtractionTaskFunction } from "../constructs/sfn-attributes-task/sfn-attributes-task";
import { ClassificationTaskFunction } from "../constructs/sfn-classification-task/sfn-classification-task";
import { MetaclassTaskFunction } from "../constructs/sfn-metaclass-task/sfn-metaclass-task";
import { Smartproductonboardingdemowebsite } from "../constructs/websites/smartproductonboardingdemowebsite";
import { CategorizationWorkflow } from "../constructs/workflow/workflow";

export class ApplicationStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const branchPrefix = PDKPipeline.getBranchPrefix({
      node: Stack.of(this).node,
    });

    const ssmParameterPrefix =
      "/ProductCategorization" + (branchPrefix ? "/" + branchPrefix : "");

    const logsBucket = new SecureBucket(this, "LogsBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [],
      serverAccessLogsPrefix: undefined,
    });

    const inputBucket = new SecureBucket(this, "inputBucket", {
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(10),
        },
      ],
      cors: [
        {
          allowedHeaders: ["content-type"],
          allowedOrigins: ["http://localhost:3000"],
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
          ],
        },
      ],
      serverAccessLogsPrefix: "inputBucket-logs",
      serverAccessLogsBucket: logsBucket,
    });
    const configurationBucket = new SecureBucket(this, "configurationBucket", {
      lifecycleRules: [],
      serverAccessLogsPrefix: "configurationBucket-logs",
      serverAccessLogsBucket: logsBucket,
    });

    const configBucketParam = new ssm.StringParameter(
      this,
      "ConfigurationBucketParam",
      {
        parameterName: ssmParameterPrefix + "/ConfigurationBucket",
        stringValue: configurationBucket.bucketName,
      },
    );

    new CfnOutput(this, "CategorizationConfigBucket", {
      value: configBucketParam.parameterName,
    });

    const outputBucket = new SecureBucket(this, "outputBucket", {
      cors: [
        {
          allowedOrigins: ["http://localhost:3000"],
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        },
      ],
    });

    const apiPersistence = new ApiPersistence(this, "ApiPersistence");

    // This policy gets populated in the metaclasses notebook to grant read access to the DynamoDB table created there.
    const wordEmbeddingsPolicy = new iam.ManagedPolicy(
      this,
      "WordEmbeddingsPolicy",
      {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            sid: "NoopPlaceholder",
            notActions: ["*"],
            notResources: ["*"],
          }),
        ],
      },
    );

    NagSuppressions.addResourceSuppressions(
      wordEmbeddingsPolicy,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "This policy is populated by the metaclasses notebook.",
        },
      ],
      true,
    );

    new ssm.StringParameter(this, "WordEmbeddingsPolicyParam", {
      parameterName: ssmParameterPrefix + "/WordEmbeddingsPolicyArn",
      stringValue: wordEmbeddingsPolicy.managedPolicyArn,
    });

    const metaclassTaskFunction = new MetaclassTaskFunction(
      this,
      "MetaclassTaskFunction",
      {
        ssmParameterPrefix: ssmParameterPrefix,
        configBucket: configurationBucket,
        wordEmbeddingsPolicy: wordEmbeddingsPolicy,
      },
    );

    const classificationTaskFunction = new ClassificationTaskFunction(
      this,
      "ClassificationTaskFunction",
      {
        ssmParameterPrefix: ssmParameterPrefix,
        configBucket: configurationBucket,
      },
    );

    const attributeExtractionFunction = new AttributeExtractionTaskFunction(
      this,
      "AttributeExtractionTaskFunction",
      {
        configBucket: configurationBucket,
      },
    );

    const batchCategorizationMachine = new CategorizationWorkflow(
      this,
      "CategorizationWorkflow",
      {
        inputBucket: inputBucket,
        outputBucket: outputBucket,
        sessionTable: apiPersistence.sessionTable,
        configurationBucket: configurationBucket,
        metaclassTaskFunction: metaclassTaskFunction,
        classificationTaskFunction: classificationTaskFunction,
        attributeExtractionTaskFunction: attributeExtractionFunction,
      },
    );

    const userPool = new cognito.UserPool(this, "DemoUserPool", {
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      autoVerify: {
        email: true,
      },
      featurePlan: cognito.FeaturePlan.PLUS,
    });

    NagSuppressions.addResourceSuppressions(
      userPool,
      [
        {
          id: "AwsSolutions-COG2",
          reason:
            "The Cognito User Pool is used for demo purposes only. In production, MFA should be required.",
        },
        {
          id: "AwsSolutions-COG3",
          reason:
            "Advanced Security Features is deprecated in favor of the Plus feature plan.",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "The Cognito SMS Role has wildcards to send SMS MFA tokens.",
        },
      ],
      true,
    );

    const userIdentity = new UserIdentity(this, `${id}UserIdentity`, {
      userPool: userPool,
    });

    const api = new SmartProductOnboardingAPI(this, "Api", {
      userIdentity: userIdentity,
      inputBucket: inputBucket,
      outputBucket: outputBucket,
      persistenceLayer: apiPersistence,
      batchCategorizationMachine: batchCategorizationMachine.stateMachine,
      ssmParameterPrefix: ssmParameterPrefix,
      configurationBucket: configurationBucket,
      wordEmbeddingsPolicy: wordEmbeddingsPolicy,
    });

    const website = new Smartproductonboardingdemowebsite(this, "DemoWeb", {
      userIdentity: userIdentity,
      smartproductonboardingapi: api,
      inputBucket: inputBucket,
      configBucket: configurationBucket,
    });

    NagSuppressions.addResourceSuppressionsByPath(
      Stack.of(this),
      `/${
        Stack.of(this).node.path
      }/Custom::CDKBucketDeployment8693BB64968944B69AAFB0CC9EB8756C`,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Managed upstream by AWS PDK",
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Managed upstream by AWS PDK",
        },
        {
          id: "AwsSolutions-L1",
          reason: "Managed upstream by AWS PDK",
        },
      ],
      true,
    );

    const wordVectorsUrl = scope.node.tryGetContext("wordVectorsUrl");

    new ssm.StringParameter(this, "WordVectorsUrlParam", {
      parameterName: ssmParameterPrefix + "/EmbeddingsModelUrl",
      stringValue: wordVectorsUrl,
      description:
        "URL of the embeddings model used for metaclass classification",
    });

    new CfnOutput(this, "UserPool", {
      value: userIdentity.userPool.userPoolId,
    });

    new CfnOutput(this, "UserPoolClient", {
      value: userIdentity.userPoolClient.userPoolClientId,
    });

    new CfnOutput(this, "IdentityPool", {
      value: userIdentity.identityPool.identityPoolId,
    });

    new CfnOutput(this, "InputBucket", {
      value: inputBucket.bucketName,
    });
    new CfnOutput(this, "ConfigurationBucket", {
      value: configurationBucket.bucketName,
    });
    new CfnOutput(this, "OutputBucket", {
      value: outputBucket.bucketName,
    });
    new CfnOutput(this, "SSMParameterPrefix", {
      value: ssmParameterPrefix,
    });
    new CfnOutput(this, "WebsiteUrl", {
      value: website.websiteUrl,
    });
  }
}
