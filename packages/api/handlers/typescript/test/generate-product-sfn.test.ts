/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { ThrottlingException } from "@aws-sdk/client-bedrock-runtime";
import { handler } from "../src/generate-product-sfn";
import { ProductGeneratorService } from "../src/services/productGenerator";
import {
  ModelResponseError,
  RateLimitError,
  RetryableError,
} from "../src/utils/exceptions";

// Mock dependencies
jest.mock("@aws-lambda-powertools/parameters/ssm");
jest.mock("../src/services/productGenerator");

// Mock environment variables
const originalEnv = process.env;
process.env = {
  ...originalEnv,
  IMAGE_BUCKET: "test-bucket",
};

describe("Lambda Handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
      usage: mockUsage,
    });

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

  it("should use custom config from SSM parameter", async () => {
    const customConfig = {
      temperature: 0.5,
      model: "custom-model",
      language: "Spanish",
      descriptionLength: "long",
      examples: [{ title: "Example", description: "Description" }],
    };

    (getParameter as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(customConfig),
    );

    const mockProductData = {
      title: "Test Product",
      description: "Test Description",
    };

    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
    });

    process.env.CONFIG_PARAM_NAME = "test-config-param";

    const event = {
      images: ["image1.jpg"],
      metadata: "test metadata",
    };

    const result = await handler(event);

    expect(result).toEqual(mockProductData);
    expect(
      ProductGeneratorService.prototype.generateProduct,
    ).toHaveBeenCalledWith({
      ...customConfig,
      imageKeys: event.images,
      metadata: event.metadata,
    });
  });

  it("should throw RateLimitError on ThrottlingException", async () => {
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(
      new ThrottlingException({
        $metadata: {},
        message: "Rate limit exceeded",
      }),
    );

    const event = {
      images: ["image1.jpg"],
    };

    await expect(handler(event)).rejects.toThrow(RateLimitError);
  });

  it("should throw RetryableError on ModelResponseError", async () => {
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(new ModelResponseError("Invalid model output"));

    const event = {
      images: ["image1.jpg"],
    };

    await expect(handler(event)).rejects.toThrow(RetryableError);
  });

  it("should handle and log unknown errors", async () => {
    const unknownError = new Error("Unknown error");
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockRejectedValueOnce(unknownError);

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

    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockResolvedValueOnce({
      productData: mockProductData,
    });

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
