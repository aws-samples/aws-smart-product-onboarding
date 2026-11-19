/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Logger } from "@aws-lambda-powertools/logger";

// Mock dependencies
jest.mock("../src/services/productGenerator");

const mockGetConfiguration = jest.fn();
jest.mock("../src/services/appConfigClient", () => ({
  AppConfigClient: jest.fn().mockImplementation(() => ({
    getConfiguration: mockGetConfiguration,
  })),
}));

const originalEnv = process.env;

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as Logger;

function makeRequest(bodyOverrides: Record<string, unknown> = {}) {
  return {
    input: {
      body: {
        productImages: ["image1.jpg"],
        language: "English",
        descriptionLength: "medium",
        metadata: "test metadata",
        examples: [],
        model: undefined as string | undefined,
        temperature: undefined as number | undefined,
        ...bodyOverrides,
      },
    },
    interceptorContext: {
      logger: mockLogger,
    },
    chain: { next: jest.fn() },
  } as any;
}

describe("generate-product handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetConfiguration.mockResolvedValue(null);
    process.env = {
      ...originalEnv,
      IMAGE_BUCKET: "test-bucket",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use AppConfig modelId and temperature when available", async () => {
    mockGetConfiguration.mockResolvedValueOnce({
      modelId: "appconfig-model",
      temperature: 0.7,
    });

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const { generateProduct } = require("../src/generate-product");
    const request = makeRequest();
    const result = await generateProduct(request);

    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "appconfig-model",
        temperature: 0.7,
      }),
    );
    expect(result.statusCode).toBe(200);
  });

  it("should fall back to env var defaults when AppConfig returns null", async () => {
    mockGetConfiguration.mockResolvedValueOnce(null);
    process.env.BEDROCK_MODEL_ID = "env-model-id";

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const { generateProduct } = require("../src/generate-product");
    const request = makeRequest();
    const result = await generateProduct(request);

    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "env-model-id",
        temperature: 0.1,
      }),
    );
    expect(result.statusCode).toBe(200);
  });

  it("should let request body values take precedence over AppConfig", async () => {
    mockGetConfiguration.mockResolvedValueOnce({
      modelId: "appconfig-model",
      temperature: 0.7,
    });

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const { generateProduct } = require("../src/generate-product");
    const request = makeRequest({
      model: "request-body-model",
      temperature: 0.3,
    });
    const result = await generateProduct(request);

    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "request-body-model",
        temperature: 0.3,
      }),
    );
    expect(result.statusCode).toBe(200);
  });

  it("should export a handler that takes no callback parameter", () => {
    // Node.js 24 rejects handlers with three or more parameters.
    const { handler } = require("../src/generate-product");
    expect(handler.length).toBeLessThan(3);
  });

  it("should pass API Gateway events through the handler", async () => {
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const { handler } = require("../src/generate-product");
    const result = await handler(
      {
        body: JSON.stringify({ productImages: ["image1.jpg"] }),
        headers: {},
        multiValueHeaders: {},
        pathParameters: null,
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
      },
      {},
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).product).toEqual({
      title: "T",
      description: "D",
    });
  });

  it("should not log request headers or authorizer claims", async () => {
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const token = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2ln";
    const request = {
      ...makeRequest(),
      event: {
        headers: { Authorization: token },
        multiValueHeaders: { Authorization: [token] },
        requestContext: {
          authorizer: { claims: { email: "someone@example.com" } },
        },
      },
    };
    const { generateProduct } = require("../src/generate-product");
    await generateProduct(request);

    const logged = JSON.stringify(
      Object.values(mockLogger).flatMap((fn) => (fn as jest.Mock).mock.calls),
    );
    expect(logged).toContain("Start GenerateProduct Operation");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("Authorization");
    expect(logged).not.toContain("someone@example.com");
  });
});
