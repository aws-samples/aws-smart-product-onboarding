/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  ArnFormat,
  aws_appconfig as appconfig,
  aws_iam as iam,
  Stack,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export interface AppConfigConstructProps {
  applicationName: string;
  environmentName: string;
}

export class AppConfigConstruct extends Construct {
  public readonly applicationId: string;
  public readonly environmentId: string;
  public readonly configurationProfileId: string;

  constructor(scope: Construct, id: string, props: AppConfigConstructProps) {
    super(scope, id);

    const application = new appconfig.CfnApplication(this, "Application", {
      name: props.applicationName,
    });

    const environment = new appconfig.CfnEnvironment(this, "Environment", {
      applicationId: application.ref,
      name: props.environmentName,
    });

    const configurationProfile = new appconfig.CfnConfigurationProfile(
      this,
      "ConfigurationProfile",
      {
        applicationId: application.ref,
        name: "AIModelSettings",
        locationUri: "hosted",
        type: "AWS.Freeform",
        validators: [
          {
            type: "JSON_SCHEMA",
            content: JSON.stringify({
              $schema: "http://json-schema.org/draft-07/schema#",
              type: "object",
              required: [
                "productGeneration",
                "metaclassClassification",
                "productCategorization",
                "attributeExtraction",
              ],
              additionalProperties: false,
              properties: {
                productGeneration: {
                  $ref: "#/$defs/productGenerationConfig",
                },
                metaclassClassification: { $ref: "#/$defs/componentConfig" },
                productCategorization: { $ref: "#/$defs/componentConfig" },
                attributeExtraction: { $ref: "#/$defs/componentConfig" },
              },
              $defs: {
                componentConfig: {
                  type: "object",
                  required: ["modelId", "temperature"],
                  additionalProperties: false,
                  properties: {
                    modelId: { type: "string", minLength: 1 },
                    temperature: { type: "number", minimum: 0, maximum: 1 },
                  },
                },
                productGenerationConfig: {
                  type: "object",
                  required: ["modelId", "temperature"],
                  additionalProperties: false,
                  properties: {
                    modelId: { type: "string", minLength: 1 },
                    temperature: { type: "number", minimum: 0, maximum: 1 },
                    language: { type: "string" },
                    descriptionLength: {
                      type: "string",
                      enum: ["short", "medium", "long"],
                    },
                    examples: {
                      type: "array",
                      maxItems: 10,
                      items: {
                        type: "object",
                        required: ["title", "description"],
                        additionalProperties: false,
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            }),
          },
        ],
      },
    );

    new appconfig.CfnDeploymentStrategy(this, "DeploymentStrategy", {
      name: `${props.applicationName}-instant`,
      deploymentDurationInMinutes: 0,
      growthFactor: 100,
      replicateTo: "NONE",
      finalBakeTimeInMinutes: 0,
    });

    this.applicationId = application.ref;
    this.environmentId = environment.ref;
    this.configurationProfileId = configurationProfile.ref;
  }

  public grantRead(grantee: iam.IGrantable): void {
    const stack = Stack.of(this);

    const configProfileArn = stack.formatArn({
      service: "appconfig",
      resource: "application",
      resourceName: `${this.applicationId}/environment/${this.environmentId}/configuration/${this.configurationProfileId}`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });

    grantee.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          "appconfig:StartConfigurationSession",
          "appconfig:GetLatestConfiguration",
        ],
        resources: [configProfileArn],
      }),
    );
  }
}
