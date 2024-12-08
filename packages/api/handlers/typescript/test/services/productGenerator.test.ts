/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  BedrockRuntimeClient,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import {
  formatExamples,
  getParagraphCount,
  ProductGeneratorService,
  parseProductXml,
  preparePrompt,
} from "../../src/services/productGenerator";
import {
  BadRequestError,
  ModelResponseError,
} from "../../src/utils/exceptions";

// Mock the external dependencies
jest.mock("@aws-sdk/client-bedrock-runtime");
jest.mock("@aws-sdk/client-s3");
jest.mock("../../src/utils/logger");

describe("ProductGeneratorService", () => {
  let service: ProductGeneratorService;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockBedrockClient: jest.Mocked<BedrockRuntimeClient>;

  beforeEach(() => {
    mockS3Client = new S3Client({}) as jest.Mocked<S3Client>;
    mockBedrockClient = new BedrockRuntimeClient(
      {},
    ) as jest.Mocked<BedrockRuntimeClient>;
    service = new ProductGeneratorService(
      mockS3Client,
      mockBedrockClient,
      "test-bucket",
    );
  });

  describe("generateProductTitleAndDescription", () => {
    it("should successfully generate product title and description", async () => {
      const mockResponse: ConverseCommandOutput = {
        metrics: undefined,
        stopReason: "stop_sequence",
        output: {
          message: {
            role: "assistant",
            content: [
              {
                text: "<title>Test Title</title><description>Test Description</description>",
              },
            ],
          },
        },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        $metadata: {},
      };

      (mockBedrockClient.send as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await service.generateProductTitleAndDescription(
        "test-model",
        0.7,
        { role: "user", content: [{ text: "test prompt" }] },
      );

      expect(result.productData).toEqual({
        title: "Test Title",
        description: "Test Description",
      });
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });
    });

    it('should throw ModelResponseError when stop reason is not "stop_sequence"', async () => {
      const mockResponse: ConverseCommandOutput = {
        metrics: undefined,
        output: undefined,
        usage: undefined,
        stopReason: "max_tokens",
        $metadata: {},
      };

      (mockBedrockClient.send as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(
        service.generateProductTitleAndDescription("test-model", 0.7, {
          role: "user",
          content: [{ text: "test prompt" }],
        }),
      ).rejects.toThrow(ModelResponseError);
    });
  });
});

describe("preparePrompt", () => {
  it("should prepare prompt with basic parameters", () => {
    const result = preparePrompt({
      images: [{ source: { bytes: new Uint8Array() }, format: "jpeg" }],
    });

    expect(result.prompt.role).toBe("user");
    expect(result.prompt.content).toBeDefined();
    expect(result.prompt.content?.length).toBe(2);
    expect(result.prompt.content?.[1]?.text).toContain("Output Format:");
  });

  it("should include language in prompt when specified", () => {
    const result = preparePrompt({
      images: [{ source: { bytes: new Uint8Array() }, format: "jpeg" }],
      language: "Spanish",
    });

    expect(result.prompt.content).toBeDefined();
    const textContent = result.prompt.content?.find(
      (content) => "text" in content,
    );
    expect(textContent).toBeDefined();
    expect("text" in textContent!).toBeTruthy();
    expect(textContent!.text).toContain("in Spanish");
  });
});

describe("getParagraphCount", () => {
  it("should return correct paragraph count for valid lengths", () => {
    expect(getParagraphCount("short")).toBe("one paragraph");
    expect(getParagraphCount("medium")).toBe("three paragraphs");
    expect(getParagraphCount("long")).toBe("five paragraphs");
  });

  it("should throw BadRequestError for invalid length", () => {
    expect(() => getParagraphCount("invalid")).toThrow(BadRequestError);
  });
});

describe("formatExamples", () => {
  it("should format examples correctly", () => {
    const examples = [
      { title: "Title 1", description: "Description 1" },
      { title: "Title 2", description: "Description 2" },
    ];

    const result = formatExamples(examples);
    expect(result).toContain("<title>Title 1</title>");
    expect(result).toContain("<description>Description 1</description>");
    expect(result).toContain("<title>Title 2</title>");
    expect(result).toContain("<description>Description 2</description>");
  });
});

describe("parseProductXml", () => {
  it("should parse valid XML correctly", () => {
    const xml =
      "<product><title>Test Title</title><description>Test Description</description></product>";
    const result = parseProductXml(xml);

    expect(result).toEqual({
      title: "Test Title",
      description: "Test Description",
    });
  });

  it("should throw ModelResponseError for invalid XML", () => {
    const invalidXml = "<invalid>xml</invalid>";
    expect(() => parseProductXml(invalidXml)).toThrow(ModelResponseError);
  });
});
