/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ThrottlingException } from "@aws-sdk/client-bedrock-runtime";
import {
  ModelResponseError,
  RateLimitError,
  RetryableError,
} from "../src/utils/exceptions";

// Mock dependencies
jest.mock("../src/services/productGenerator");

const mockGetConfiguration = jest.fn();
jest.mock("../src/services/appConfigClient", () => ({
  AppConfigClient: jest.fn().mockImplementation(() => ({
    getConfiguration: mockGetConfiguration,
  })),
}));

// Mock environment variables
const originalEnv = process.env;

describe("Lambda Handler", () => {
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

  it("should successfully generate product data with default config", async () => {
    const mockProductData = {
      title: "Test Product",
      description: "Test Description",
    };
    const mockUsage = {
      inputTokens: 100,
      outputTokens: 200,
    };

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
      usage: mockUsage,
    });

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      images: ["image1.jpg", "image2.jpg"],
    };

    const result = await handler(event);

    expect(result).toEqual(mockProductData);
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith({
      model: "us.amazon.nova-lite-v1:0",
      temperature: 0.1,
      imageKeys: event.images,
      language: undefined,
      descriptionLength: "medium",
      examples: [],
      metadata: undefined,
    });
  });

  it("should use AppConfig values when available", async () => {
    mockGetConfiguration.mockResolvedValueOnce({
      modelId: "appconfig-model-id",
      temperature: 0.8,
      language: "Spanish",
      descriptionLength: "long",
      examples: [{ title: "Example", description: "Description" }],
    });

    const mockProductData = {
      title: "Test Product",
      description: "Test Description",
    };

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
    });

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      images: ["image1.jpg"],
      metadata: "test metadata",
    };

    const result = await handler(event);

    expect(result).toEqual(mockProductData);
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith({
      model: "appconfig-model-id",
      temperature: 0.8,
      language: "Spanish",
      descriptionLength: "long",
      examples: [{ title: "Example", description: "Description" }],
      imageKeys: event.images,
      metadata: event.metadata,
    });
  });

  it("should fall back to defaults when AppConfig returns null", async () => {
    mockGetConfiguration.mockResolvedValueOnce(null);

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
    });

    const { handler } = require("../src/generate-product-sfn");
    const result = await handler({ images: ["img.jpg"] });

    expect(result).toEqual({ title: "T", description: "D" });
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "us.amazon.nova-lite-v1:0",
        temperature: 0.1,
        language: undefined,
        descriptionLength: "medium",
        examples: [],
      }),
    );
  });

  it("should use partial AppConfig values with defaults for missing fields", async () => {
    mockGetConfiguration.mockResolvedValueOnce({
      modelId: "custom-model",
      temperature: 0.5,
    });

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: { title: "T", description: "D" },
    });

    const { handler } = require("../src/generate-product-sfn");
    await handler({ images: ["img.jpg"] });

    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "custom-model",
        temperature: 0.5,
        language: undefined,
        descriptionLength: "medium",
        examples: [],
      }),
    );
  });

  it("should throw RateLimitError on ThrottlingException", async () => {
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(
      new ThrottlingException({
        $metadata: {},
        message: "Rate limit exceeded",
      }),
    );

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      images: ["image1.jpg"],
    };

    await expect(handler(event)).rejects.toThrow("Bedrock rate limit exceeded");
  });

  it("should throw RetryableError on ModelResponseError", async () => {
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(new ModelResponseError("Invalid model output"));

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      images: ["image1.jpg"],
    };

    await expect(handler(event)).rejects.toThrow("Invalid model output");
  });

  it("should handle and log unknown errors", async () => {
    const unknownError = new Error("Unknown error");
    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(unknownError);

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      images: ["image1.jpg"],
    };

    await expect(handler(event)).rejects.toThrow(unknownError);
  });

  it("should apply the image prefix", async () => {
    const mockProductData = {
      title: "Test Product",
      description: "Test Description",
    };

    const {
      ProductGeneratorService,
    } = require("../src/services/productGenerator");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
    });

    const { handler } = require("../src/generate-product-sfn");
    const event = {
      prefix: "prefix",
      images: ["image1.jpg"],
    };

    const result = await handler(event);

    expect(result).toEqual(mockProductData);
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith({
      model: "us.amazon.nova-lite-v1:0",
      temperature: 0.1,
      imageKeys: ["prefix/image1.jpg"],
      language: undefined,
      descriptionLength: "medium",
      examples: [],
      metadata: undefined,
    });
  });
});
