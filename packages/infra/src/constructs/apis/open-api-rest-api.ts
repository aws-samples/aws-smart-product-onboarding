/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import { Stack, aws_wafv2 as wafv2 } from "aws-cdk-lib";
import {
  ApiDefinition,
  Cors,
  SpecRestApi,
  SpecRestApiProps,
} from "aws-cdk-lib/aws-apigateway";
import { IUserPool } from "aws-cdk-lib/aws-cognito";
import { CfnPermission, IFunction } from "aws-cdk-lib/aws-lambda";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";

const HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export interface OpenApiRestApiProps
  extends Omit<SpecRestApiProps, "apiDefinition"> {
  /**
   * Path to the bundled OpenAPI definition (JSON).
   */
  readonly specPath: string;
  /**
   * The Lambda function that handles each operation, keyed by operationId.
   * Every operation in the definition needs exactly one entry.
   */
  readonly integrations: { [operationId: string]: IFunction };
  /**
   * The user pool whose tokens every operation requires.
   */
  readonly userPool: IUserPool;
  /**
   * The security scheme name for the user pool authorizer.
   */
  readonly authorizerId: string;
  /**
   * The origin allowed by CORS preflight and validation error responses.
   */
  readonly corsOrigin: string;
  /**
   * The methods allowed by CORS preflight responses.
   */
  readonly corsAllowMethods: string[];
}

interface CorsSettings {
  readonly allowHeaders: string[];
  readonly allowMethods: string[];
  readonly allowOrigins: string[];
  readonly statusCode: number;
}

/**
 * A REST API built from an OpenAPI definition.
 *
 * At synth time it adds the API Gateway extensions to the definition: a Lambda proxy integration and the
 * Cognito user pool authorizer on every operation, request validation of bodies and parameters, a 400
 * response for invalid bodies, and unauthenticated CORS preflight methods. It also grants API Gateway
 * permission to invoke each function and attaches an AWS WAF web ACL to the stage.
 */
export class OpenApiRestApi extends Construct {
  public readonly api: SpecRestApi;
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: OpenApiRestApiProps) {
    super(scope, id);
    const {
      specPath,
      integrations,
      userPool,
      authorizerId,
      corsOrigin,
      corsAllowMethods,
      ...restApiProps
    } = props;

    const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
    const operations = listOperations(spec);
    const missing = operations
      .map((op) => op.operationId)
      .filter((operationId) => !(operationId in integrations));
    const unknown = Object.keys(integrations).filter(
      (operationId) => !operations.some((op) => op.operationId === operationId),
    );
    if (missing.length > 0 || unknown.length > 0) {
      throw new Error(
        `Integrations do not match the API operations. Missing: [${missing.join(", ")}]. Unknown: [${unknown.join(", ")}].`,
      );
    }

    const stack = Stack.of(this);
    const preparedSpec = prepareSpec(spec, {
      integrationUri: (operationId) =>
        `arn:${stack.partition}:apigateway:${stack.region}:lambda:path/2015-03-31/functions/${integrations[operationId].functionArn}/invocations`,
      authorizerId,
      securityScheme: {
        type: "apiKey",
        name: "Authorization",
        in: "header",
        "x-amazon-apigateway-authtype": "COGNITO_USER_POOLS",
        "x-amazon-apigateway-authorizer": {
          type: "COGNITO_USER_POOLS",
          providerARNs: [userPool.userPoolArn],
        },
      },
      cors: {
        allowHeaders: [...Cors.DEFAULT_HEADERS, "x-amz-content-sha256"],
        allowMethods: corsAllowMethods,
        allowOrigins: [corsOrigin],
        statusCode: 204,
      },
    });

    this.api = new SpecRestApi(this, id, {
      ...restApiProps,
      apiDefinition: ApiDefinition.fromInline(preparedSpec),
    });
    // Redeploy the stage whenever the prepared definition changes.
    this.api.latestDeployment?.addToLogicalId(preparedSpec);

    for (const { operationId, method, path } of operations) {
      new CfnPermission(this, `LambdaPermission-${operationId}`, {
        action: "lambda:InvokeFunction",
        principal: "apigateway.amazonaws.com",
        functionName: integrations[operationId].functionArn,
        sourceArn: stack.formatArn({
          service: "execute-api",
          resource: this.api.restApiId,
          // Any stage, this operation's method and path, with path parameters as wildcards.
          resourceName: `*/${method.toUpperCase()}${path.replace(/{[^}]*}/g, "*")}`,
        }),
      });
    }

    this.webAcl = createWebAcl(
      this,
      `${id}-Acl`,
      this.api.deploymentStage.stageArn,
    );

    NagSuppressions.addResourceSuppressions(
      this,
      [
        {
          id: "AwsSolutions-IAM4",
          reason:
            "The API Gateway CloudWatch role needs the AWS managed policy to create and write log groups at the account level.",
          appliesTo: [
            "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs",
          ],
        },
        {
          id: "AwsSolutions-APIG2",
          reason:
            "Request validation of bodies and parameters is set in the OpenAPI definition (x-amazon-apigateway-request-validators).",
        },
      ],
      true,
    );
  }
}

interface Operation {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
}

function listOperations(spec: any): Operation[] {
  return Object.entries<any>(spec.paths).flatMap(([path, pathItem]) =>
    HTTP_METHODS.filter((method) => pathItem[method]).map((method) => {
      const operationId = pathItem[method].operationId;
      if (!operationId) {
        throw new Error(`Operation ${method} ${path} has no operationId`);
      }
      return { operationId, method, path };
    }),
  );
}

interface PrepareSpecOptions {
  readonly integrationUri: (operationId: string) => string;
  readonly authorizerId: string;
  readonly securityScheme: object;
  readonly cors: CorsSettings;
}

const corsHeaderDefinitions = () => ({
  "Access-Control-Allow-Origin": { schema: { type: "string" } },
  "Access-Control-Allow-Methods": { schema: { type: "string" } },
  "Access-Control-Allow-Headers": { schema: { type: "string" } },
});

const corsResponseParameters = (cors: CorsSettings, prefix: string) => ({
  [`${prefix}.Access-Control-Allow-Headers`]: `'${cors.allowHeaders.join(",")}'`,
  [`${prefix}.Access-Control-Allow-Methods`]: `'${cors.allowMethods.join(",")}'`,
  [`${prefix}.Access-Control-Allow-Origin`]: `'${cors.allowOrigins.join(",")}'`,
});

/**
 * Add the API Gateway extensions to an OpenAPI definition.
 * See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html
 */
function prepareSpec(spec: any, options: PrepareSpecOptions): any {
  // Header parameters in the definition must also be allowed by CORS preflight.
  const headerParameters = new Set<string>();
  for (const pathItem of Object.values<any>(spec.paths)) {
    for (const method of HTTP_METHODS) {
      for (const parameter of pathItem[method]?.parameters ?? []) {
        if (parameter.in === "header") headerParameters.add(parameter.name);
      }
    }
  }
  const cors: CorsSettings = {
    ...options.cors,
    allowHeaders: [...options.cors.allowHeaders, ...headerParameters],
  };

  const prepareOperation = (operation: any) => ({
    ...operation,
    responses: Object.fromEntries(
      Object.entries<any>(operation.responses).map(([statusCode, response]) => [
        statusCode,
        {
          ...response,
          headers: { ...corsHeaderDefinitions(), ...response.headers },
        },
      ]),
    ),
    "x-amazon-apigateway-integration": {
      type: "AWS_PROXY",
      httpMethod: "POST",
      uri: options.integrationUri(operation.operationId),
      passthroughBehavior: "WHEN_NO_MATCH",
    },
    security: [{ [options.authorizerId]: [] }],
  });

  const corsPreflight = {
    summary: "CORS Support",
    description: "Enable CORS by returning the correct headers",
    responses: {
      [`${cors.statusCode}`]: {
        description: "Default response for CORS method",
        headers: corsHeaderDefinitions(),
        content: {},
      },
    },
    "x-amazon-apigateway-integration": {
      type: "mock",
      requestTemplates: {
        "application/json": `{"statusCode": ${cors.statusCode}}`,
      },
      responses: {
        default: {
          statusCode: `${cors.statusCode}`,
          responseParameters: corsResponseParameters(
            cors,
            "method.response.header",
          ),
          responseTemplates: { "application/json": "{}" },
        },
      },
    },
    // Preflight requests carry no credentials.
    security: [],
    "x-amazon-apigateway-auth": { type: "NONE" },
  };

  return {
    ...spec,
    "x-amazon-apigateway-request-validators": {
      all: { validateRequestBody: true, validateRequestParameters: true },
    },
    "x-amazon-apigateway-request-validator": "all",
    "x-amazon-apigateway-gateway-responses": {
      BAD_REQUEST_BODY: {
        statusCode: 400,
        responseTemplates: {
          "application/json":
            '{"message": "$context.error.validationErrorString"}',
        },
        responseParameters: corsResponseParameters(
          cors,
          "gatewayresponse.header",
        ),
      },
    },
    paths: Object.fromEntries(
      Object.entries<any>(spec.paths).map(([path, pathItem]) => {
        if (pathItem.options) {
          throw new Error(
            `Path ${path} defines OPTIONS, which is reserved for CORS preflight`,
          );
        }
        return [
          path,
          {
            ...pathItem,
            ...Object.fromEntries(
              HTTP_METHODS.filter((method) => pathItem[method]).map(
                (method) => [method, prepareOperation(pathItem[method])],
              ),
            ),
            options: corsPreflight,
          },
        ];
      }),
    ),
    components: {
      ...spec.components,
      securitySchemes: {
        ...spec.components?.securitySchemes,
        [options.authorizerId]: options.securityScheme,
      },
    },
  };
}

/**
 * A regional web ACL with the AWS managed common rule set, associated with the API stage.
 */
function createWebAcl(
  scope: Construct,
  id: string,
  stageArn: string,
): wafv2.CfnWebACL {
  const construct = new Construct(scope, id);
  const aclName = `${Stack.of(scope).stackName}-${id}-${construct.node.addr.slice(-8)}`;
  const ruleName = "AWSManagedRulesCommonRuleSet";
  const webAcl = new wafv2.CfnWebACL(construct, "ApiWebACL", {
    name: aclName,
    defaultAction: { allow: {} },
    scope: "REGIONAL",
    visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      sampledRequestsEnabled: true,
      metricName: aclName,
    },
    rules: [
      {
        name: `AWS-${ruleName}`,
        priority: 2,
        statement: {
          managedRuleGroupStatement: { vendorName: "AWS", name: ruleName },
        },
        overrideAction: { none: {} },
        visibilityConfig: {
          metricName: `${aclName}-AWS-${ruleName}`,
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
        },
      },
    ],
  });
  new wafv2.CfnWebACLAssociation(construct, "WebACLAssociation", {
    resourceArn: stageArn,
    webAclArn: webAcl.attrArn,
  });
  return webAcl;
}
