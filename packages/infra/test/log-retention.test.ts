/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ApplicationStack } from "../src/stacks/application-stack";

test("log groups keep 30 days and the API stage writes access logs", () => {
  const app = new App({ context: { wordVectorsUrl: "https://testurl" } });
  const template = Template.fromStack(new ApplicationStack(app, "test"));

  const logGroups = template.findResources("AWS::Logs::LogGroup");
  expect(Object.keys(logGroups).sort()).toEqual([
    "ApiAccessLogs02C2A02B",
    "CategorizationWorkflowProductCategorization8EC540F2",
  ]);
  for (const logGroup of Object.values(logGroups)) {
    expect(logGroup.Properties.RetentionInDays).toBe(30);
  }

  template.hasResourceProperties("AWS::ApiGateway::Stage", {
    AccessLogSetting: {
      DestinationArn: { "Fn::GetAtt": ["ApiAccessLogs02C2A02B", "Arn"] },
      Format: Match.stringLikeRegexp("^\\$context\\.identity\\.sourceIp "),
    },
    MethodSettings: [Match.objectLike({ LoggingLevel: "INFO" })],
  });
});
