/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { logger } from "../utils/logger";

export interface AppConfigSettings {
  modelId: string;
  temperature: number;
}

export class AppConfigClient {
  private readonly client: AppConfigDataClient;
  private readonly applicationId: string;
  private readonly environmentId: string;
  private readonly configurationProfileId: string;
  private sessionToken: string | undefined;

  constructor(
    applicationId: string,
    environmentId: string,
    configurationProfileId: string,
  ) {
    this.applicationId = applicationId;
    this.environmentId = environmentId;
    this.configurationProfileId = configurationProfileId;
    this.client = new AppConfigDataClient({});
  }

  async getConfiguration(
    componentKey: string,
  ): Promise<AppConfigSettings | null> {
    try {
      if (!this.sessionToken) {
        await this.startSession();
      }

      const response = await this.client.send(
        new GetLatestConfigurationCommand({
          ConfigurationToken: this.sessionToken,
        }),
      );

      // Update session token for next poll
      this.sessionToken = response.NextPollConfigurationToken;

      // Empty body means no configuration has changed (or none deployed yet)
      if (!response.Configuration || response.Configuration.length === 0) {
        logger.info("AppConfig returned empty configuration body");
        return null;
      }

      const configText = new TextDecoder().decode(response.Configuration);
      const configDocument = JSON.parse(configText);

      const componentConfig = configDocument[componentKey];
      if (!componentConfig) {
        logger.warn(
          `Missing component key '${componentKey}' in AppConfig configuration`,
        );
        return null;
      }

      return {
        modelId: componentConfig.modelId,
        temperature: componentConfig.temperature,
      };
    } catch (error) {
      logger.warn("Failed to retrieve AppConfig configuration", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Reset session token so next call starts a fresh session
      this.sessionToken = undefined;
      return null;
    }
  }

  private async startSession(): Promise<void> {
    const response = await this.client.send(
      new StartConfigurationSessionCommand({
        ApplicationIdentifier: this.applicationId,
        EnvironmentIdentifier: this.environmentId,
        ConfigurationProfileIdentifier: this.configurationProfileId,
      }),
    );
    this.sessionToken = response.InitialConfigurationToken;
  }
}
