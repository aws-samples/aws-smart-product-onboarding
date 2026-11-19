/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { apiGatewayEvent, lambdaContext } from "./api-gateway-event";

// Mock dependencies
jest.mock("../src/services/productGenerator");

const mockGetConfiguration = jest.fn();
jest.mock("../src/services/appConfigClient", () => ({
  AppConfigClient: jest.fn().mockImplementation(() => ({
    getConfiguration: mockGetConfiguration,
  })),
}));

const originalEnv = process.env;

function makeBody(bodyOverrides: Record<string, unknown> = {}) {
  return {
    productImages: ["image1.jpg"],
    language: "English",
    descriptionLength: "medium",
    metadata: "test metadata",
    examples: [],
    model: undefined as string | undefined,
    temperature: undefined as number | undefined,
    ...bodyOverrides,
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
    const body = makeBody();
    const result = await generateProduct(body);

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
    const body = makeBody();
    const result = await generateProduct(body);

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
    const body = makeBody({
      model: "request-body-model",
      temperature: 0.3,
    });
    const result = await generateProduct(body);

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
      apiGatewayEvent(JSON.stringify({ productImages: ["image1.jpg"] })),
      lambdaContext,
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).product).toEqual({
      title: "T",
      description: "D",
    });
  });

  it.each([
    ["a body that is not JSON", "not json"],
    ["a missing body", null],
    ["missing productImages", JSON.stringify({ language: "English" })],
    ["productImages of the wrong type", JSON.stringify({ productImages: "a" })],
    [
      "an unknown model",
      JSON.stringify({ productImages: ["a"], model: "unknown-model" }),
    ],
  ])("should answer %s with 400, not 422", async (_name, body) => {
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    const { handler } = require("../src/generate-product");
    const result = await handler(apiGatewayEvent(body), lambdaContext);

    expect(result.statusCode).toBe(400);
    expect(result.headers["x-amzn-errortype"]).toBe("BadRequestError");
    expect(JSON.parse(result.body)).toEqual({
      message: "Invalid request body",
    });
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).not.toHaveBeenCalled();
  });

  it("should not log request headers or authorizer claims", async () => {
    process.env.POWERTOOLS_LOG_LEVEL = "DEBUG";
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
    const baseEvent = apiGatewayEvent(
      JSON.stringify({ productImages: ["image1.jpg"] }),
    );
    const event = {
      ...baseEvent,
      headers: { ...baseEvent.headers, Authorization: token },
      multiValueHeaders: {
        ...baseEvent.multiValueHeaders,
        Authorization: [token],
      },
      requestContext: {
        ...baseEvent.requestContext,
        authorizer: { claims: { email: "someone@example.com" } },
      },
    };
    const written: string[] = [];
    const stdout = jest
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: any) => {
        written.push(String(chunk));
        return true;
      });
    try {
      const { handler } = require("../src/generate-product");
      const result = await handler(event, lambdaContext);
      expect(result.statusCode).toBe(200);
    } finally {
      stdout.mockRestore();
    }

    const logged = written.join("");
    expect(logged).toContain("Start GenerateProduct Operation");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("Authorization");
    expect(logged).not.toContain("someone@example.com");
  });
});
