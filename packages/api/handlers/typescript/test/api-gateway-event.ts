/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * An API Gateway REST API proxy event for POST /generateProduct with the given raw body.
 */
export const apiGatewayEvent = (body: string | null) => ({
  resource: "/generateProduct",
  path: "/generateProduct",
  httpMethod: "POST",
  headers: { "Content-Type": "application/json" },
  multiValueHeaders: { "Content-Type": ["application/json"] },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    resourcePath: "/generateProduct",
    httpMethod: "POST",
    path: "/prod/generateProduct",
    stage: "prod",
    requestId: "request-id",
    identity: { sourceIp: "127.0.0.1" },
  },
  body,
  isBase64Encoded: false,
});

export const lambdaContext = {
  functionName: "generate-product",
  awsRequestId: "aws-request-id",
  invokedFunctionArn:
    "arn:aws:lambda:us-east-1:123456789012:function:generate-product",
  memoryLimitInMB: "512",
  functionVersion: "$LATEST",
};
