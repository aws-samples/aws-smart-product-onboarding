/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Logger } from "@aws-lambda-powertools/logger";
import {
  GenerateProductChainedHandlerFunction,
  generateProductHandler,
  INTERCEPTORS,
  LoggingInterceptor,
  Response,
} from "@aws-samples/smart-product-onboarding-api-typescript-runtime";
import {
  BedrockRuntimeClient,
  ValidationException,
  ResourceNotFoundException,
  ThrottlingException,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { ProductGeneratorService } from "./services/productGenerator";
import { BadRequestError } from "./utils/exceptions";

const logger = new Logger({ serviceName: "GenerateProduct" });

const defaultTemperature = 0.1;
const defaultModel =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-haiku-20240307-v1:0";

/**
 * Type-safe handler for the GenerateProduct operation
 */
export const generateProduct: GenerateProductChainedHandlerFunction = async (
  request,
) => {
  LoggingInterceptor.getLogger(request).info("Start GenerateProduct Operation");
  LoggingInterceptor.getLogger(request).debug("Input: ", request.input);

  const bucket = process.env.IMAGE_BUCKET;
  if (!bucket) {
    logger.error("IMAGE_BUCKET environment variable not set!");
    throw Response.internalFailure({ message: "Internal server error" });
  }

  const productGenerator = new ProductGeneratorService(
    new S3Client({}),
    new BedrockRuntimeClient({}),
    bucket,
  );

  const model = request.input.body.model || defaultModel;
  if (!model) {
    logger.error("model variable not set");
    throw Response.internalFailure({ message: "Internal server error" });
  }
  const temperature = request.input.body.temperature || defaultTemperature;
  if (isNaN(temperature)) {
    logger.error("temperature not set");
    throw Response.internalFailure({ message: "Internal server error" });
  }
  if (temperature < 0 || temperature > 1) {
    throw Response.badRequest({
      message: "Temperature must be between 0 and 1",
    });
  }

  try {
    const result = await productGenerator.generateProduct({
      imageKeys: request.input.body.productImages,
      language: request.input.body.language,
      descriptionLength: request.input.body.descriptionLength,
      metadata: request.input.body.metadata,
      examples: request.input.body.examples,
      model: model,
      temperature: temperature,
    });

    return Response.success({
      title: result.productData.title,
      description: result.productData.description,
      usage: {
        inputTokens: result.usage?.inputTokens || Infinity,
        outputTokens: result.usage?.outputTokens || Infinity,
      },
    });
  } catch (error) {
    if (error instanceof ValidationException) {
      throw Response.badRequest({ message: "Bad request" });
    } else if (error instanceof ResourceNotFoundException) {
      throw Response.notFound({ message: "Not Found" });
    } else if (error instanceof ThrottlingException) {
      throw Response.internalFailure({
        message: "Bedrock rate limit exceeded",
      });
    } else if (error instanceof BadRequestError) {
      logger.error(`Invalid input. ${error.name}: ${error.message}`);
      throw Response.badRequest({ message: error.message });
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
    throw Response.internalFailure({
      message: "Internal server error",
    });
  }
};

/**
 * Entry point for the AWS Lambda handler for the GenerateProduct operation.
 * The generateProductHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = generateProductHandler(...INTERCEPTORS, generateProduct);
