/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import * as path from "path";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { AccessLogFormat } from "aws-cdk-lib/aws-apigateway";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { OpenApiRestApi } from "../src/constructs/apis/open-api-rest-api";
import { ApplicationStack } from "../src/stacks/application-stack";

const SPEC_PATH = path.resolve(__dirname, "../../api/model/.api.json");
const CORS_ORIGIN = "http://localhost:3000";
const CORS_HEADERS =
  "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,x-amz-content-sha256'";

// Every operation, its method and path, and the logical ID of the function behind it.
const OPERATIONS: { [op: string]: [string, string, string] } = {
  metaclass: ["post", "/metaclass", "ApiMetaclassFunction7E70EAAB"],
  categorizeProduct: [
    "post",
    "/categorizeProduct",
    "ApiCategorizeProductFunctionE7DE99B9",
  ],
  extractAttributes: [
    "post",
    "/extractAttributes",
    "ApiExtractAttributesFunctionA5AC337C",
  ],
  generateProduct: [
    "post",
    "/generateProduct",
    "ApiGenerateProductFunction2D66D00D",
  ],
  createBatchExecution: [
    "post",
    "/createBatchExecution",
    "ApiCreateBatchExecutionFunction299428DB",
  ],
  listBatchExecutions: [
    "get",
    "/listBatchExecutions",
    "ApiListBatchExecutionsFunctionE54D5746",
  ],
  getBatchExecution: [
    "get",
    "/getBatchExecution/{executionId}",
    "ApiGetBatchExecutionFunction6F19E639",
  ],
  downloadFile: ["post", "/downloadFile", "ApiDownloadFileFunction224E544B"],
  uploadFile: ["post", "/uploadFile", "ApiUploadFileFunction64919EA2"],
};

const PERMISSION_IDS: { [op: string]: string } = {
  metaclass: "ApiLambdaPermissionmetaclass822CDB76",
  categorizeProduct: "ApiLambdaPermissioncategorizeProductF936951E",
  extractAttributes: "ApiLambdaPermissionextractAttributes6E529505",
  generateProduct: "ApiLambdaPermissiongenerateProductB700A516",
  createBatchExecution: "ApiLambdaPermissioncreateBatchExecution8C86DA83",
  listBatchExecutions: "ApiLambdaPermissionlistBatchExecutions7B971EB0",
  getBatchExecution: "ApiLambdaPermissiongetBatchExecutionC58EBECA",
  downloadFile: "ApiLambdaPermissiondownloadFile80E4D36B",
  uploadFile: "ApiLambdaPermissionuploadFile7D508350",
};

let template: Template;
let resources: { [id: string]: any };
let body: any;
let assemblyDir: string;

beforeAll(() => {
  const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
  // The deployed stack name, because some logical IDs derive from it.
  const stack = new ApplicationStack(app, "smart-product-onboarding");
  assemblyDir = app.synth().directory;
  template = Template.fromStack(stack);
  resources = template.toJSON().Resources;
  body = resources.Api6B55D0A0.Properties.Body;
});

describe("API authorization", () => {
  test("every operation requires the Cognito user pool and preflight is open", () => {
    const userPoolId = Object.keys(
      template.findResources("AWS::Cognito::UserPool"),
    );
    expect(userPoolId).toEqual(["DemoUserPool1AB98549"]);
    expect(body.security).toBeUndefined();
    expect(body.components.securitySchemes).toEqual({
      CognitoUserPool: {
        type: "apiKey",
        name: "Authorization",
        in: "header",
        "x-amazon-apigateway-authtype": "COGNITO_USER_POOLS",
        "x-amazon-apigateway-authorizer": {
          type: "COGNITO_USER_POOLS",
          providerARNs: [{ "Fn::GetAtt": ["DemoUserPool1AB98549", "Arn"] }],
        },
      },
    });

    let authenticated = 0;
    for (const [apiPath, pathItem] of Object.entries<any>(body.paths)) {
      for (const [method, operation] of Object.entries<any>(pathItem)) {
        if (method === "options") {
          expect(operation.security).toEqual([]);
          expect(operation["x-amazon-apigateway-auth"]).toEqual({
            type: "NONE",
          });
        } else {
          expect([apiPath, method, operation.security]).toEqual([
            apiPath,
            method,
            [{ CognitoUserPool: [] }],
          ]);
          expect(operation["x-amazon-apigateway-auth"]).toBeUndefined();
          authenticated++;
        }
      }
    }
    expect(authenticated).toBe(Object.keys(OPERATIONS).length);

    // Methods added outside the OpenAPI definition must use the same authorizer.
    for (const method of Object.values<any>(
      template.findResources("AWS::ApiGateway::Method"),
    )) {
      if (method.Properties.HttpMethod !== "OPTIONS") {
        expect(method.Properties.AuthorizationType).toBe("COGNITO_USER_POOLS");
      }
    }
  });
});

describe("API request validation", () => {
  test("bodies and parameters are validated and invalid bodies get 400", () => {
    expect(body["x-amazon-apigateway-request-validators"]).toEqual({
      all: { validateRequestBody: true, validateRequestParameters: true },
    });
    expect(body["x-amazon-apigateway-request-validator"]).toBe("all");
    for (const pathItem of Object.values<any>(body.paths)) {
      for (const operation of Object.values<any>(pathItem)) {
        expect(
          operation["x-amazon-apigateway-request-validator"],
        ).toBeUndefined();
      }
    }
    expect(body["x-amazon-apigateway-gateway-responses"]).toEqual({
      BAD_REQUEST_BODY: {
        statusCode: 400,
        responseTemplates: {
          "application/json":
            '{"message": "$context.error.validationErrorString"}',
        },
        responseParameters: {
          "gatewayresponse.header.Access-Control-Allow-Headers": CORS_HEADERS,
          "gatewayresponse.header.Access-Control-Allow-Methods": "'GET,POST'",
          "gatewayresponse.header.Access-Control-Allow-Origin": `'${CORS_ORIGIN}'`,
        },
      },
    });
  });
});

describe("API CORS", () => {
  test("every path answers preflight with the allowed origin, methods and headers", () => {
    for (const pathItem of Object.values<any>(body.paths)) {
      const integration = pathItem.options["x-amazon-apigateway-integration"];
      expect(integration.type).toBe("mock");
      expect(integration.requestTemplates).toEqual({
        "application/json": '{"statusCode": 204}',
      });
      expect(integration.responses.default).toEqual({
        statusCode: "204",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Headers": CORS_HEADERS,
          "method.response.header.Access-Control-Allow-Methods": "'GET,POST'",
          "method.response.header.Access-Control-Allow-Origin": `'${CORS_ORIGIN}'`,
        },
        responseTemplates: { "application/json": "{}" },
      });
    }
  });

  test("default 4XX and 5XX gateway responses carry CORS headers", () => {
    for (const [id, type] of [
      ["ApiDefault4XXE8C97745", "DEFAULT_4XX"],
      ["ApiDefault5XX5AEE77E8", "DEFAULT_5XX"],
    ]) {
      expect(resources[id].Properties).toEqual({
        ResponseType: type,
        RestApiId: { Ref: "Api6B55D0A0" },
        ResponseParameters: {
          "gatewayresponse.header.Access-Control-Allow-Origin": `'${CORS_ORIGIN}'`,
          "gatewayresponse.header.Access-Control-Allow-Headers": "'*'",
        },
      });
    }
  });
});

describe("API integrations", () => {
  test("the API has exactly the expected paths, methods and Lambda proxy integrations", () => {
    const expected: { [p: string]: string[] } = {};
    for (const [method, apiPath] of Object.values(OPERATIONS)) {
      expected[apiPath] = [method, "options"];
    }
    expect(
      Object.fromEntries(
        Object.entries<any>(body.paths).map(([p, item]) => [
          p,
          Object.keys(item).filter((k) => k !== "parameters"),
        ]),
      ),
    ).toEqual(expected);

    for (const [operationId, [method, apiPath, functionId]] of Object.entries(
      OPERATIONS,
    )) {
      const operation = body.paths[apiPath][method];
      expect(operation.operationId).toBe(operationId);
      expect(operation["x-amazon-apigateway-integration"]).toEqual({
        type: "AWS_PROXY",
        httpMethod: "POST",
        uri: {
          "Fn::Join": [
            "",
            [
              "arn:",
              { Ref: "AWS::Partition" },
              ":apigateway:",
              { Ref: "AWS::Region" },
              ":lambda:path/2015-03-31/functions/",
              { "Fn::GetAtt": [functionId, "Arn"] },
              "/invocations",
            ],
          ],
        },
        passthroughBehavior: "WHEN_NO_MATCH",
      });
    }
  });

  test("API Gateway may invoke each function only for its own operation", () => {
    const permissions = template.findResources("AWS::Lambda::Permission", {
      Properties: { Principal: "apigateway.amazonaws.com" },
    });
    expect(Object.keys(permissions).sort()).toEqual(
      Object.values(PERMISSION_IDS).sort(),
    );
    for (const [operationId, [method, apiPath, functionId]] of Object.entries(
      OPERATIONS,
    )) {
      expect(permissions[PERMISSION_IDS[operationId]].Properties).toEqual({
        Action: "lambda:InvokeFunction",
        FunctionName: { "Fn::GetAtt": [functionId, "Arn"] },
        Principal: "apigateway.amazonaws.com",
        SourceArn: {
          "Fn::Join": [
            "",
            [
              "arn:",
              { Ref: "AWS::Partition" },
              ":execute-api:",
              { Ref: "AWS::Region" },
              ":",
              { Ref: "AWS::AccountId" },
              ":",
              { Ref: "Api6B55D0A0" },
              `/*/${method.toUpperCase()}${apiPath.replace(/{[^}]*}/g, "*")}`,
            ],
          ],
        },
      });
    }
  });
});

describe("API stage", () => {
  test("the stage writes CLF access logs at INFO level", () => {
    expect(resources.ApiDeploymentStageprodBD2FB4EE.Properties).toMatchObject({
      RestApiId: { Ref: "Api6B55D0A0" },
      StageName: "prod",
      AccessLogSetting: {
        DestinationArn: { "Fn::GetAtt": ["ApiAccessLogs02C2A02B", "Arn"] },
        Format: AccessLogFormat.clf().toString(),
      },
      MethodSettings: [
        {
          DataTraceEnabled: false,
          HttpMethod: "*",
          LoggingLevel: "INFO",
          ResourcePath: "/*",
        },
      ],
    });
  });

  test("the stage is protected by a web ACL with the AWS common rule set", () => {
    const association = resources.ApiApiAclWebACLAssociation9474F21C.Properties;
    expect(association.WebACLArn).toEqual({
      "Fn::GetAtt": ["ApiApiAclApiWebACL25028803", "Arn"],
    });
    expect(JSON.stringify(association.ResourceArn)).toContain(
      '{"Ref":"ApiDeploymentStageprodBD2FB4EE"}',
    );
    const webAcl = resources.ApiApiAclApiWebACL25028803.Properties;
    expect(webAcl.Scope).toBe("REGIONAL");
    // A different name would replace the web ACL.
    expect(webAcl.Name).toBe("smart-product-onboarding-Api-Acl-ae9e1fdf");
    expect(webAcl.Rules).toEqual([
      expect.objectContaining({
        Statement: {
          ManagedRuleGroupStatement: {
            VendorName: "AWS",
            Name: "AWSManagedRulesCommonRuleSet",
          },
        },
        OverrideAction: { None: {} },
      }),
    ]);
  });
});

describe("Deployed resource identity", () => {
  test("resources that existing deployments depend on keep their logical IDs", () => {
    const expected: { [id: string]: string } = {
      Api6B55D0A0: "AWS::ApiGateway::RestApi",
      ApiDeploymentStageprodBD2FB4EE: "AWS::ApiGateway::Stage",
      ApiAccessLogs02C2A02B: "AWS::Logs::LogGroup",
      ApiAccount45D5A63C: "AWS::ApiGateway::Account",
      ApiCloudWatchRole1DE5C6E1: "AWS::IAM::Role",
      ApiDefault4XXE8C97745: "AWS::ApiGateway::GatewayResponse",
      ApiDefault5XX5AEE77E8: "AWS::ApiGateway::GatewayResponse",
      ApiApiAclApiWebACL25028803: "AWS::WAFv2::WebACL",
      ApiApiAclWebACLAssociation9474F21C: "AWS::WAFv2::WebACLAssociation",
      DemoUserPool1AB98549: "AWS::Cognito::UserPool",
      DemoUserPoolWebClient3C1F8A5C: "AWS::Cognito::UserPoolClient",
      smartproductonboardingUserIdentityIdentityPoolCCFE9607:
        "AWS::Cognito::IdentityPool",
      smartproductonboardingUserIdentityIdentityPoolDefaultRoleAttachment3A17558D:
        "AWS::Cognito::IdentityPoolRoleAttachment",
    };
    for (const [operationId, [, , functionId]] of Object.entries(OPERATIONS)) {
      expected[functionId] = "AWS::Lambda::Function";
      expected[PERMISSION_IDS[operationId]] = "AWS::Lambda::Permission";
    }
    for (const [id, type] of Object.entries(expected)) {
      expect([id, resources[id]?.Type]).toEqual([id, type]);
    }
    expect(
      Object.keys(template.findResources("AWS::ApiGateway::RestApi")),
    ).toEqual(["Api6B55D0A0"]);
    expect(template.toJSON().Outputs.ApiEndpoint7B58C87D).toBeDefined();
  });

  test("the website runtime config points at the API stage URL", () => {
    const config =
      resources.DemoWebRuntimeConfigCustomResource86470C57.Properties;
    const assetHash = config.SourceObjectKeys[0].replace(/\.zip$/, "");
    const configJson = fs.readFileSync(
      path.join(assemblyDir, `asset.${assetHash}`, "runtime-config.json"),
      "utf-8",
    );
    const url =
      JSON.parse(configJson).typeSafeApis["smart-product-onboarding-api"];
    const markers = config.SourceMarkers[0];
    const resolved = url.replace(
      /<<marker:0xbaba:(\d+)>>/g,
      (_: string, i: string) =>
        JSON.stringify(markers[`<<marker:0xbaba:${i}>>`]),
    );
    expect(resolved).toBe(
      'https://{"Ref":"Api6B55D0A0"}.execute-api.{"Ref":"AWS::Region"}.{"Ref":"AWS::URLSuffix"}/{"Ref":"ApiDeploymentStageprodBD2FB4EE"}/',
    );
  });

  test("no Lambda function runs on Node.js 18", () => {
    for (const fn of Object.values<any>(
      template.findResources("AWS::Lambda::Function"),
    )) {
      expect(fn.Properties.Runtime ?? "").not.toMatch(/^nodejs18/);
    }
    expect(
      Object.keys(resources).filter((id) => id.includes("PrepareSpec")),
    ).toEqual([]);
  });
});

describe("OpenApiRestApi", () => {
  const build = (
    integrations: (fn: Function) => { [op: string]: Function },
  ) => {
    const stack = new Stack();
    const fn = new Function(stack, "Fn", {
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromInline("exports.handler = async () => ({});"),
    });
    new OpenApiRestApi(stack, "Api", {
      specPath: SPEC_PATH,
      userPool: new UserPool(stack, "Pool"),
      authorizerId: "CognitoUserPool",
      corsOrigin: CORS_ORIGIN,
      corsAllowMethods: ["GET", "POST"],
      integrations: integrations(fn),
    });
  };
  const all = (fn: Function) =>
    Object.fromEntries(Object.keys(OPERATIONS).map((op) => [op, fn]));

  test("accepts one integration per operation", () => {
    expect(() => build(all)).not.toThrow();
  });

  test("rejects a missing integration", () => {
    expect(() =>
      build((fn) => {
        const { uploadFile: _omitted, ...rest } = all(fn);
        return rest;
      }),
    ).toThrow(/Missing: \[uploadFile\]/);
  });

  test("rejects an integration for an unknown operation", () => {
    expect(() => build((fn) => ({ ...all(fn), deleteEverything: fn }))).toThrow(
      /Unknown: \[deleteEverything\]/,
    );
  });
});
