/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import {
  RequestValidationError,
  Router,
} from "@aws-lambda-powertools/event-handler/http";
import { tracer as tracerMiddleware } from "@aws-lambda-powertools/event-handler/http/middleware/tracer";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { Tracer } from "@aws-lambda-powertools/tracer";
import {
  BedrockRuntimeClient,
  ResourceNotFoundException,
  ThrottlingException,
  ValidationException,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import type { Context } from "aws-lambda";
import {
  GenProductRequestContent,
  GenProductResponseContent,
  genProductRequestSchema,
} from "./schemas/gen-product-request";
import { AppConfigClient } from "./services/appConfigClient";
import { ProductGeneratorService } from "./services/productGenerator";
import { TemplateService } from "./services/templateService";
import { BadRequestError } from "./utils/exceptions";

const OPERATION_ID = "generateProduct";

const logger = new Logger({ serviceName: "GenerateProduct" });
const tracer = new Tracer();
const metrics = new Metrics();

const appConfigClient = new AppConfigClient(
  process.env.APPCONFIG_APPLICATION_ID || "",
  process.env.APPCONFIG_ENVIRONMENT_ID || "",
  process.env.APPCONFIG_CONFIGURATION_PROFILE_ID || "",
);

const defaultTemperature = 0.1;
const defaultModel =
  process.env.BEDROCK_MODEL_ID || "global.anthropic.claude-haiku-5-5";

export interface OperationResponse {
  readonly statusCode: number;
  readonly body: GenProductResponseContent | { message: string };
}

const ok = (body: GenProductResponseContent): OperationResponse => ({
  statusCode: 200,
  body,
});
const error = (statusCode: number, message: string): OperationResponse => ({
  statusCode,
  body: { message },
});

// Error types declared in the OpenAPI definition, returned in the x-amzn-errortype header.
const ERROR_TYPES: { [statusCode: number]: string } = {
  400: "BadRequestError",
  403: "NotAuthorizedError",
  500: "InternalFailureError",
};

/**
 * Build the API Gateway response: a JSON body, the error type for declared errors, and CORS headers.
 */
const toHttpResponse = ({ statusCode, body }: OperationResponse) => ({
  statusCode,
  headers: {
    ...(ERROR_TYPES[statusCode] && {
      "x-amzn-errortype": ERROR_TYPES[statusCode],
    }),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  },
  body,
});

/**
 * Generate a product title and description from the request.
 */
export const generateProduct = async (
  input: GenProductRequestContent,
): Promise<OperationResponse> => {
  logger.info("Start GenerateProduct Operation");
  logger.debug("Input: ", { input });

  const bucket = process.env.IMAGE_BUCKET;
  if (!bucket) {
    logger.error("IMAGE_BUCKET environment variable not set!");
    return error(500, "Internal server error");
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

  // AppConfig values override env var defaults; request body values take precedence over all
  const appConfig = await appConfigClient.getConfiguration("productGeneration");
  const model = input.model || appConfig?.modelId || defaultModel;
  if (!model) {
    logger.error("model variable not set");
    return error(500, "Internal server error");
  }
  const temperature =
    input.temperature ?? appConfig?.temperature ?? defaultTemperature;
  if (isNaN(temperature)) {
    logger.error("temperature not set");
    return error(500, "Internal server error");
  }
  if (temperature < 0 || temperature > 1) {
    return error(400, "Temperature must be between 0 and 1");
  }

  try {
    const result = await productGenerator.generateProduct({
      imageKeys: input.productImages,
      language: input.language,
      descriptionLength: input.descriptionLength,
      metadata: input.metadata,
      examples: input.examples,
      model: model,
      temperature: temperature,
    });

    return ok({
      product: {
        title: result.productData.title,
        description: result.productData.description,
      },
      usage: {
        inputTokens: result.usage?.inputTokens || Infinity,
        outputTokens: result.usage?.outputTokens || Infinity,
      },
    });
  } catch (e) {
    if (e instanceof ValidationException) {
      return error(400, "Bad request");
    } else if (e instanceof ResourceNotFoundException) {
      return error(404, "Not Found");
    } else if (e instanceof ThrottlingException) {
      return error(500, "Bedrock rate limit exceeded");
    } else if (e instanceof BadRequestError) {
      logger.error(`Invalid input. ${e.name}: ${e.message}`);
      return error(400, e.message);
    } else if (e instanceof Error) {
      logger.error(`Failed to generate product data. ${e.name}: ${e.message}`);
      if (e.stack) {
        logger.error(e.stack);
      }
    } else {
      logger.error(`An unknown error occurred: ${JSON.stringify(e)}`);
    }
    return error(500, "Internal server error");
  }
};

const app = new Router({ logger });

app.post(
  `/${OPERATION_ID}`,
  [tracerMiddleware(tracer, { captureResponse: false })],
  async (reqCtx) =>
    toHttpResponse(await generateProduct(reqCtx.valid.req.body)),
  { validation: { req: { body: genProductRequestSchema } } },
);

// API Gateway validates the body first, so this only catches requests that bypass it. Answer 400, not 422.
app.errorHandler(RequestValidationError, async (e) => {
  logger.warn("Request body failed validation", { error: e });
  return toHttpResponse(error(400, "Invalid request body"));
});

app.errorHandler(Error, async (e) => {
  logger.error("Unhandled error", { error: e });
  return toHttpResponse(error(500, "Internal Error"));
});

/**
 * Entry point for the AWS Lambda handler for the GenerateProduct operation.
 * Node.js 24 rejects handlers that take three or more parameters, so this one takes two.
 */
export const handler = async (event: unknown, context: Context) => {
  logger.addContext(context);
  logger.appendKeys({ operationId: OPERATION_ID });
  metrics.addDimension("operationId", OPERATION_ID);
  try {
    return await app.resolve(event, context);
  } finally {
    metrics.publishStoredMetrics();
    logger.removeKeys(["operationId"]);
  }
};
