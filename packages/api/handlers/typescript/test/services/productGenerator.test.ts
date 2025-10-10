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
import { TemplateService } from "../../src/services/templateService";
import { ProductData } from "../../src/types";
import {
  BadRequestError,
  ModelResponseError,
} from "../../src/utils/exceptions";

// Mock the external dependencies
jest.mock("@aws-sdk/client-bedrock-runtime");
jest.mock("@aws-sdk/client-s3");
jest.mock("../../src/utils/logger");
jest.mock("../../src/services/templateService");

describe("ProductGeneratorService", () => {
  let service: ProductGeneratorService;
  let serviceWithTemplate: ProductGeneratorService;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockBedrockClient: jest.Mocked<BedrockRuntimeClient>;
  let mockTemplateService: jest.Mocked<TemplateService>;

  beforeEach(() => {
    mockS3Client = new S3Client({}) as jest.Mocked<S3Client>;
    mockBedrockClient = new BedrockRuntimeClient(
      {},
    ) as jest.Mocked<BedrockRuntimeClient>;
    mockTemplateService = new TemplateService(
      "test-templates",
    ) as jest.Mocked<TemplateService>;

    // Service without template service (legacy mode)
    service = new ProductGeneratorService(
      mockS3Client,
      mockBedrockClient,
      "test-bucket",
    );

    // Service with template service
    serviceWithTemplate = new ProductGeneratorService(
      mockS3Client,
      mockBedrockClient,
      "test-bucket",
      mockTemplateService,
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

  describe("generateProduct with template system", () => {
    beforeEach(() => {
      // Mock S3 getObject
      (mockS3Client.send as jest.Mock).mockResolvedValue({
        Body: {
          transformToByteArray: () =>
            Promise.resolve(new Uint8Array([1, 2, 3])),
        },
        ContentType: "image/jpeg",
        ContentLength: 3,
      });

      // Mock Bedrock response
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
      (mockBedrockClient.send as jest.Mock).mockResolvedValue(mockResponse);
    });

    it("should use template service when available", async () => {
      const mockRenderedPrompt = "Rendered template prompt";
      (mockTemplateService.render as jest.Mock).mockResolvedValue(
        mockRenderedPrompt,
      );

      const result = await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        language: "English",
        descriptionLength: "short",
        metadata: "test metadata",
        examples: [
          { title: "Example Title", description: "Example Description" },
        ],
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          language: "English",
          descriptionLength: "short",
          paragraphCount: "one paragraph",
          metadata: "test metadata",
          imageCount: 1,
          examples: {
            formatted: expect.stringContaining("Example Title"),
            items: [
              { title: "Example Title", description: "Example Description" },
            ],
          },
          conditionals: {
            hasExamples: true,
            hasMetadata: true,
            hasDescriptionLength: true,
            hasLanguage: true,
            isMultipleImages: false,
          },
        }),
      );

      expect(result.productData).toEqual({
        title: "Test Title",
        description: "Test Description",
      });
    });

    it("should fallback to legacy implementation when template service is not available", async () => {
      const result = await service.generateProduct({
        imageKeys: ["test-image.jpg"],
        language: "English",
        model: "test-model",
        temperature: 0.7,
      });

      expect(result.productData).toEqual({
        title: "Test Title",
        description: "Test Description",
      });
      // Template service should not be called
      expect(mockTemplateService.render).not.toHaveBeenCalled();
    });

    it("should handle template context with no optional parameters", async () => {
      const mockRenderedPrompt = "Basic template prompt";
      (mockTemplateService.render as jest.Mock).mockResolvedValue(
        mockRenderedPrompt,
      );

      await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          language: undefined,
          descriptionLength: undefined,
          paragraphCount: undefined,
          metadata: undefined,
          imageCount: 1,
          conditionals: {
            hasExamples: false,
            hasMetadata: false,
            hasDescriptionLength: false,
            hasLanguage: false,
            isMultipleImages: false,
          },
        }),
      );
    });

    it("should handle multiple images correctly", async () => {
      const mockRenderedPrompt = "Multiple images template prompt";
      (mockTemplateService.render as jest.Mock).mockResolvedValue(
        mockRenderedPrompt,
      );

      await serviceWithTemplate.generateProduct({
        imageKeys: ["image1.jpg", "image2.jpg", "image3.jpg"],
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          imageCount: 3,
          conditionals: expect.objectContaining({
            isMultipleImages: true,
          }),
        }),
      );
    });

    it("should handle all description lengths correctly", async () => {
      const mockRenderedPrompt = "Template prompt with description length";
      (mockTemplateService.render as jest.Mock).mockResolvedValue(
        mockRenderedPrompt,
      );

      // Test short
      await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        descriptionLength: "short",
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          descriptionLength: "short",
          paragraphCount: "one paragraph",
        }),
      );

      // Test medium
      await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        descriptionLength: "medium",
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          descriptionLength: "medium",
          paragraphCount: "three paragraphs",
        }),
      );

      // Test long
      await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        descriptionLength: "long",
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          descriptionLength: "long",
          paragraphCount: "five paragraphs",
        }),
      );
    });

    it("should handle empty examples array correctly", async () => {
      const mockRenderedPrompt = "Template prompt without examples";
      (mockTemplateService.render as jest.Mock).mockResolvedValue(
        mockRenderedPrompt,
      );

      await serviceWithTemplate.generateProduct({
        imageKeys: ["test-image.jpg"],
        examples: [],
        model: "test-model",
        temperature: 0.7,
      });

      expect(mockTemplateService.render).toHaveBeenCalledWith(
        "product-generation-xml-improved",
        expect.objectContaining({
          conditionals: expect.objectContaining({
            hasExamples: false,
          }),
        }),
      );

      // Verify that examples property is not set when empty array is provided
      const callArgs = (mockTemplateService.render as jest.Mock).mock
        .calls[0][1];
      expect(callArgs.examples).toBeUndefined();
    });

    it("should propagate template service errors", async () => {
      const templateError = new Error("Template rendering failed");
      (mockTemplateService.render as jest.Mock).mockRejectedValue(
        templateError,
      );

      await expect(
        serviceWithTemplate.generateProduct({
          imageKeys: ["test-image.jpg"],
          model: "test-model",
          temperature: 0.7,
        }),
      ).rejects.toThrow("Template rendering failed");
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
