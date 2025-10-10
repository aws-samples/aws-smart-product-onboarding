/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import {
  BedrockRuntimeClient,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { ProductGeneratorService } from "./services/productGenerator";
import { TemplateService } from "./services/templateService";
import { ProductData } from "./types";
import {
  ModelResponseError,
  RateLimitError,
  RetryableError,
} from "./utils/exceptions";

const logger = new Logger({ serviceName: "GenerateProduct" });

const defaultTemperature = 0.1;
const defaultModel =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

interface ProductGeneratorConfig {
  temperature?: number;
  model?: string;
  language?: string;
  descriptionLength?: string;
  examples?: ProductData[];
}

interface GenerateProductEvent {
  images: string[];
  metadata?: string;
  prefix?: string;
}

export const handler = async (event: GenerateProductEvent) => {
  logger.debug(`Event: ${JSON.stringify(event)}`);
  const bucket = process.env.IMAGE_BUCKET;
  if (!bucket) {
    logger.error("IMAGE_BUCKET environment variable not set!");
    throw new Error("IMAGE_BUCKET environment variable not set!");
  }

  // Initialize TemplateService with the templates directory
  const templateService = new TemplateService(
    path.join(__dirname, "templates"),
  );

  const productGenerator = new ProductGeneratorService(
    new S3Client({}),
    new BedrockRuntimeClient({}),
    bucket,
    templateService,
  );

  const configParamName = process.env.CONFIG_PARAM_NAME;
  const config: ProductGeneratorConfig = configParamName
    ? JSON.parse(
        (await getParameter(configParamName, { maxAge: Infinity })) || "{}",
      )
    : {};
  const {
    temperature = defaultTemperature,
    model = defaultModel,
    language = undefined,
    descriptionLength = "medium",
    examples = [],
  } = config || {};

  const imageKeys = event.images.map((image) =>
    event.prefix ? `${event.prefix}/${image}` : image,
  );

  const params = {
    model,
    temperature,
    imageKeys,
    language,
    descriptionLength,
    examples,
    metadata: event.metadata,
  };

  logger.debug(`Generating product with: ${JSON.stringify(params)}`);
  try {
    const { productData, usage } =
      await productGenerator.generateProduct(params);
    logger.info(JSON.stringify({ usage: usage }));
    logger.info(JSON.stringify(productData));

    return productData;
  } catch (error) {
    if (error instanceof ThrottlingException) {
      throw new RateLimitError("Bedrock rate limit exceeded");
    } else if (error instanceof ModelResponseError) {
      throw new RetryableError(error.message);
    } else if (error instanceof Error) {
      logger.error(
        `Failed to generate product data. ${error.name}: ${error.message}`,
      );
      if (error.stack) {
        logger.error(error.stack);
      }
    } else {
      logger.error(`An unknown error occurred: ${JSON.stringify(error)}`);
    }
    throw error;
  }
};
