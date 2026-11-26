/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { ProductGeneratorService } from "../../src/services/productGenerator";
import { TemplateService } from "../../src/services/templateService";
import { ProductData } from "../../src/types";

// Mock the external dependencies
jest.mock("@aws-sdk/client-bedrock-runtime");
jest.mock("@aws-sdk/client-s3");
jest.mock("../../src/utils/logger");

describe("ProductGeneratorService Integration Tests", () => {
  let templateService: ProductGeneratorService;
  let legacyService: ProductGeneratorService;
  let actualTemplateService: TemplateService;
  let mockS3Client: jest.Mocked<S3Client>;
  let mockBedrockClient: jest.Mocked<BedrockRuntimeClient>;

  beforeEach(() => {
    mockS3Client = new S3Client({}) as jest.Mocked<S3Client>;
    mockBedrockClient = new BedrockRuntimeClient(
      {},
    ) as jest.Mocked<BedrockRuntimeClient>;

    // Use actual template service with real template directory
    const templateDir = path.join(__dirname, "../../src/templates");
    actualTemplateService = new TemplateService(templateDir);

    // Service with template system
    templateService = new ProductGeneratorService(
      mockS3Client,
      mockBedrockClient,
      "test-bucket",
      actualTemplateService,
    );

    // Service without template system (legacy)
    legacyService = new ProductGeneratorService(
      mockS3Client,
      mockBedrockClient,
      "test-bucket",
    );
  });

  describe("Template System Integration Tests", () => {
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
      (mockBedrockClient.send as jest.Mock).mockResolvedValue({
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
      });
    });

    describe("End-to-end template generation", () => {
      it("should successfully use template system with all parameters", async () => {
        const result = await templateService.generateProduct({
          imageKeys: ["test-image1.jpg", "test-image2.jpg"],
          language: "Spanish",
          descriptionLength: "medium",
          metadata: "Brand: TestBrand, Color: Blue",
          examples: [
            { title: "Example Title", description: "Example Description" },
          ],
          model: "test-model",
          temperature: 0.7,
        });

        expect(result.productData).toEqual({
          title: "Test Title",
          description: "Test Description",
        });

        // Verify that the Bedrock client was called (template system worked)
        expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      });

      it("should successfully use template system with minimal parameters", async () => {
        const result = await templateService.generateProduct({
          imageKeys: ["test-image.jpg"],
          model: "test-model",
          temperature: 0.7,
        });

        expect(result.productData).toEqual({
          title: "Test Title",
          description: "Test Description",
        });

        // Verify that the Bedrock client was called (template system worked)
        expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      });

      it("should handle template rendering with conditional logic", async () => {
        const result = await templateService.generateProduct({
          imageKeys: ["test-image.jpg"],
          descriptionLength: "short",
          model: "test-model",
          temperature: 0.7,
        });

        expect(result.productData).toEqual({
          title: "Test Title",
          description: "Test Description",
        });

        // Verify that the Bedrock client was called (template system worked)
        expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      });

      it("should handle all description length variations", async () => {
        const descriptionLengths = ["short", "medium", "long"] as const;

        for (const length of descriptionLengths) {
          const result = await templateService.generateProduct({
            imageKeys: ["test-image.jpg"],
            descriptionLength: length,
            model: "test-model",
            temperature: 0.7,
          });

          expect(result.productData).toEqual({
            title: "Test Title",
            description: "Test Description",
          });
        }

        expect(mockBedrockClient.send).toHaveBeenCalledTimes(3);
      });

      it("should handle multiple images correctly", async () => {
        const result = await templateService.generateProduct({
          imageKeys: ["image1.jpg", "image2.jpg", "image3.jpg"],
          model: "test-model",
          temperature: 0.7,
        });

        expect(result.productData).toEqual({
          title: "Test Title",
          description: "Test Description",
        });

        // Verify that the Bedrock client was called
        expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      });

      it("should handle empty examples array", async () => {
        const result = await templateService.generateProduct({
          imageKeys: ["test-image.jpg"],
          examples: [],
          model: "test-model",
          temperature: 0.7,
        });

        expect(result.productData).toEqual({
          title: "Test Title",
          description: "Test Description",
        });

        expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
      });
    });

    describe("Template vs Legacy Implementation Comparison", () => {
      const testCases = [
        {
          name: "minimal parameters",
          params: {
            imageKeys: ["test-image.jpg"],
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with language",
          params: {
            imageKeys: ["test-image.jpg"],
            language: "Spanish",
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with description length",
          params: {
            imageKeys: ["test-image.jpg"],
            descriptionLength: "medium" as const,
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with metadata",
          params: {
            imageKeys: ["test-image.jpg"],
            metadata: "Brand: TestBrand, Color: Blue",
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with examples",
          params: {
            imageKeys: ["test-image.jpg"],
            examples: [
              { title: "Example Title", description: "Example Description" },
            ],
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with all parameters",
          params: {
            imageKeys: ["test-image1.jpg", "test-image2.jpg"],
            language: "French",
            descriptionLength: "long" as const,
            metadata: "Brand: TestBrand, Color: Blue, Size: Large",
            examples: [
              {
                title: "Example Title 1",
                description: "Example Description 1",
              },
              {
                title: "Example Title 2",
                description: "Example Description 2",
              },
            ],
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "multiple images without other params",
          params: {
            imageKeys: ["image1.jpg", "image2.jpg", "image3.jpg"],
            model: "test-model",
            temperature: 0.7,
          },
        },
      ];

      testCases.forEach(({ name, params }) => {
        it(`should produce consistent results with legacy implementation for ${name}`, async () => {
          // Generate with both services
          const templateResult = await templateService.generateProduct(params);
          const legacyResult = await legacyService.generateProduct(params);

          // Both should produce the same result
          expect(templateResult.productData).toEqual(legacyResult.productData);
          expect(templateResult.usage).toEqual(legacyResult.usage);

          // Both should have called Bedrock
          expect(mockBedrockClient.send).toHaveBeenCalledTimes(2);

          // Reset mock for next test
          (mockBedrockClient.send as jest.Mock).mockClear();
        });
      });
    });

    describe("Template file validation", () => {
      it("should load and use the actual template file", async () => {
        // This test verifies that the template file exists and can be loaded
        const template =
          await actualTemplateService.loadTemplate("product-generation");
        expect(template).toBeDefined();
        expect(typeof template).toBe("function");

        // Test rendering with a simple context
        const context = {
          imageCount: 1,
          conditionals: {
            hasExamples: false,
            hasMetadata: false,
            hasDescriptionLength: false,
            hasLanguage: false,
            isMultipleImages: false,
          },
        };

        const rendered = await actualTemplateService.render(
          "product-generation",
          context,
        );
        expect(rendered).toContain("You are responsible for creating enticing");
        expect(rendered).toContain("Output Format:");
        expect(rendered).toContain("<product>");
        expect(rendered).toContain("image"); // Single image
        expect(rendered).not.toContain("images"); // Not multiple
      });

      it("should render template with all conditional branches", async () => {
        const contexts = [
          {
            name: "with examples",
            context: {
              imageCount: 1,
              examples: {
                formatted:
                  "<product><title>Test</title><description>Test desc</description></product>",
                items: [{ title: "Test", description: "Test desc" }],
              },
              conditionals: {
                hasExamples: true,
                hasMetadata: false,
                hasDescriptionLength: false,
                hasLanguage: false,
                isMultipleImages: false,
              },
            },
            expectedContains: [
              "<examples>",
              "Use the language, style, and tone demonstrated in <examples>",
            ],
            expectedNotContains: ["Tone: Friendly and conversational"],
          },
          {
            name: "with metadata",
            context: {
              imageCount: 1,
              metadata: "Test metadata",
              conditionals: {
                hasExamples: false,
                hasMetadata: true,
                hasDescriptionLength: false,
                hasLanguage: false,
                isMultipleImages: false,
              },
            },
            expectedContains: [
              "<metadata>Test metadata</metadata>",
              "and metadata in <metadata>",
            ],
            expectedNotContains: ["<examples>"],
          },
          {
            name: "with description length",
            context: {
              imageCount: 1,
              descriptionLength: "medium",
              paragraphCount: "three paragraphs",
              conditionals: {
                hasExamples: false,
                hasMetadata: false,
                hasDescriptionLength: true,
                hasLanguage: false,
                isMultipleImages: false,
              },
            },
            expectedContains: [
              "Description length: three paragraphs",
              "with three paragraphs",
            ],
            expectedNotContains: ["<examples>"],
          },
          {
            name: "with language",
            context: {
              imageCount: 1,
              language: "Spanish",
              conditionals: {
                hasExamples: false,
                hasMetadata: false,
                hasDescriptionLength: false,
                hasLanguage: true,
                isMultipleImages: false,
              },
            },
            expectedContains: ["in Spanish"],
            expectedNotContains: ["<examples>"],
          },
          {
            name: "with multiple images",
            context: {
              imageCount: 3,
              conditionals: {
                hasExamples: false,
                hasMetadata: false,
                hasDescriptionLength: false,
                hasLanguage: false,
                isMultipleImages: true,
              },
            },
            expectedContains: ["images"],
            expectedNotContains: ["image "],
          },
        ];

        for (const {
          name,
          context,
          expectedContains,
          expectedNotContains,
        } of contexts) {
          const rendered = await actualTemplateService.render(
            "product-generation",
            context,
          );

          expectedContains.forEach((text) => {
            expect(rendered).toContain(text);
          });

          expectedNotContains.forEach((text) => {
            expect(rendered).not.toContain(text);
          });
        }
      });
    });
  });

  describe("Template Rendering Validation", () => {
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
      (mockBedrockClient.send as jest.Mock).mockResolvedValue({
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
      });
    });

    it("should generate consistent results across multiple runs", async () => {
      const params = {
        imageKeys: ["test-image.jpg"],
        language: "English",
        descriptionLength: "medium" as const,
        metadata: "Brand: TestBrand",
        examples: [
          { title: "Example Title", description: "Example Description" },
        ],
        model: "test-model",
        temperature: 0.7,
      };

      // Generate the same request multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await templateService.generateProduct(params);
        results.push(result);
      }

      // All results should be identical
      expect(results[0]).toEqual(results[1]);
      expect(results[1]).toEqual(results[2]);
    });

    it("should validate template rendering produces expected content structure", async () => {
      // Test direct template rendering to validate content
      const testCases = [
        {
          name: "minimal context",
          context: {
            imageCount: 1,
            conditionals: {
              hasExamples: false,
              hasMetadata: false,
              hasDescriptionLength: false,
              hasLanguage: false,
              isMultipleImages: false,
            },
          },
          expectedContains: [
            "You are responsible for creating enticing",
            "Output Format:",
            "<product>",
            "for the product shown in the image",
          ],
          expectedNotContains: ["<examples>", "in Spanish", "three paragraphs"],
        },
        {
          name: "full context",
          context: {
            language: "Spanish",
            descriptionLength: "medium",
            paragraphCount: "three paragraphs",
            metadata: "Brand: TestBrand",
            imageCount: 2,
            examples: {
              formatted:
                "<product><title>Test</title><description>Test desc</description></product>",
              items: [{ title: "Test", description: "Test desc" }],
            },
            conditionals: {
              hasExamples: true,
              hasMetadata: true,
              hasDescriptionLength: true,
              hasLanguage: true,
              isMultipleImages: true,
            },
          },
          expectedContains: [
            "<examples>",
            "in Spanish",
            "three paragraphs",
            "<metadata>Brand: TestBrand</metadata>",
            "for the product shown in the images",
            "Use the language, style, and tone demonstrated in <examples>",
          ],
          expectedNotContains: ["Tone: Friendly and conversational"],
        },
      ];

      for (const {
        name,
        context,
        expectedContains,
        expectedNotContains,
      } of testCases) {
        const rendered = await actualTemplateService.render(
          "product-generation",
          context,
        );

        expectedContains.forEach((text) => {
          expect(rendered).toContain(text);
        });

        expectedNotContains.forEach((text) => {
          expect(rendered).not.toContain(text);
        });
      }
    });

    it("should produce functionally equivalent results to legacy implementation", async () => {
      const testCases = [
        {
          name: "basic parameters",
          params: {
            imageKeys: ["test-image.jpg"],
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "with all optional parameters",
          params: {
            imageKeys: ["image1.jpg", "image2.jpg"],
            language: "French",
            descriptionLength: "long" as const,
            metadata: "Brand: TestBrand, Color: Blue",
            examples: [
              { title: "Example Title", description: "Example Description" },
            ],
            model: "test-model",
            temperature: 0.7,
          },
        },
      ];

      for (const { name, params } of testCases) {
        // Generate with both services
        const templateResult = await templateService.generateProduct(params);
        const legacyResult = await legacyService.generateProduct(params);

        // Results should be functionally equivalent
        expect(templateResult.productData).toEqual(legacyResult.productData);
        expect(templateResult.usage).toEqual(legacyResult.usage);

        // Reset mock for next test
        (mockBedrockClient.send as jest.Mock).mockClear();
      }
    });
  });

  describe("Backward Compatibility Validation", () => {
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
      (mockBedrockClient.send as jest.Mock).mockResolvedValue({
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
      });
    });

    it("should maintain API compatibility", async () => {
      const params = {
        imageKeys: ["test-image.jpg"],
        language: "English",
        descriptionLength: "medium" as const,
        metadata: "Test metadata",
        examples: [
          { title: "Example Title", description: "Example Description" },
        ],
        model: "test-model",
        temperature: 0.7,
      };

      // Both services should accept the same parameters and return the same structure
      const templateResult = await templateService.generateProduct(params);
      const legacyResult = await legacyService.generateProduct(params);

      // Verify return structure is identical
      expect(Object.keys(templateResult)).toEqual(Object.keys(legacyResult));
      expect(typeof templateResult.productData).toBe(
        typeof legacyResult.productData,
      );
      expect(typeof templateResult.usage).toBe(typeof legacyResult.usage);

      // Verify productData structure
      expect(Object.keys(templateResult.productData)).toEqual(
        Object.keys(legacyResult.productData),
      );
      expect(typeof templateResult.productData.title).toBe("string");
      expect(typeof templateResult.productData.description).toBe("string");
    });

    it("should handle edge cases consistently", async () => {
      const edgeCases = [
        {
          name: "empty examples array",
          params: {
            imageKeys: ["test-image.jpg"],
            examples: [],
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "undefined optional parameters",
          params: {
            imageKeys: ["test-image.jpg"],
            language: undefined,
            descriptionLength: undefined,
            metadata: undefined,
            examples: undefined,
            model: "test-model",
            temperature: 0.7,
          },
        },
        {
          name: "empty metadata string",
          params: {
            imageKeys: ["test-image.jpg"],
            metadata: "",
            model: "test-model",
            temperature: 0.7,
          },
        },
      ];

      for (const { name, params } of edgeCases) {
        const templateResult = await templateService.generateProduct(params);
        const legacyResult = await legacyService.generateProduct(params);

        expect(templateResult.productData).toEqual(legacyResult.productData);
        expect(templateResult.usage).toEqual(legacyResult.usage);

        // Reset mock for next test
        (mockBedrockClient.send as jest.Mock).mockClear();
      }
    });

    it("should handle errors consistently", async () => {
      // Mock S3 error
      (mockS3Client.send as jest.Mock).mockRejectedValue(new Error("S3 Error"));

      const params = {
        imageKeys: ["test-image.jpg"],
        model: "test-model",
        temperature: 0.7,
      };

      // Both services should throw the same error
      await expect(templateService.generateProduct(params)).rejects.toThrow(
        "S3 Error",
      );
      await expect(legacyService.generateProduct(params)).rejects.toThrow(
        "S3 Error",
      );
    });

    it("should maintain performance characteristics", async () => {
      const params = {
        imageKeys: ["test-image.jpg"],
        model: "test-model",
        temperature: 0.7,
      };

      // Run multiple iterations to get more stable timing
      const iterations = 5;
      let templateTotalTime = 0;
      let legacyTotalTime = 0;

      // Measure template service performance
      for (let i = 0; i < iterations; i++) {
        const templateStart = Date.now();
        await templateService.generateProduct(params);
        templateTotalTime += Date.now() - templateStart;
      }

      // Reset mock
      (mockBedrockClient.send as jest.Mock).mockClear();

      // Measure legacy service performance
      for (let i = 0; i < iterations; i++) {
        const legacyStart = Date.now();
        await legacyService.generateProduct(params);
        legacyTotalTime += Date.now() - legacyStart;
      }

      const templateAvgTime = templateTotalTime / iterations;
      const legacyAvgTime = legacyTotalTime / iterations;

      // Template service should not be significantly slower (allow 100% overhead for template processing)
      // This is a generous allowance since template processing adds some overhead
      expect(templateAvgTime).toBeLessThan(legacyAvgTime * 2 + 10); // Add 10ms buffer for timing variations
    });
  });
});
