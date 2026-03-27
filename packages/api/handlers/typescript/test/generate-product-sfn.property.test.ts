/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Feature: appconfig-runtime-configuration, Property 6: AppConfig provides all product generation config
 * Validates: Requirements 6.2
 */

import fc from "fast-check";

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

/**
 * Arbitrary for a non-empty model ID string
 */
const modelIdArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s: string) => s.trim().length > 0);

/**
 * Arbitrary for a valid temperature: number in [0, 1]
 */
const temperatureArb = fc.double({ min: 0, max: 1, noNaN: true });

/**
 * Arbitrary for a language string
 */
const languageArb = fc.oneof(
  fc.constant(undefined as string | undefined),
  fc.constantFrom("English", "Spanish", "French", "German", "Japanese"),
);

/**
 * Arbitrary for description length
 */
const descriptionLengthArb = fc.constantFrom("short", "medium", "long");

/**
 * Arbitrary for a single product example
 */
const exampleArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
});

/**
 * Arbitrary for an array of examples (0-3)
 */
const examplesArb = fc.array(exampleArb, { minLength: 0, maxLength: 3 });

/**
 * Arbitrary for a full AppConfig response
 */
const appConfigArb = fc.record({
  modelId: modelIdArb,
  temperature: temperatureArb,
  language: languageArb,
  descriptionLength: descriptionLengthArb,
  examples: examplesArb,
});

describe("Property 6: AppConfig provides all product generation configuration", () => {
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

  /**
   * **Validates: Requirements 6.2**
   *
   * For any valid AppConfig response, the Product Generation component must use
   * all AppConfig values (modelId, temperature, language, descriptionLength, examples).
   */
  it("should use all AppConfig values for product generation", async () => {
    await fc.assert(
      fc.asyncProperty(appConfigArb, async (appConfig) => {
        jest.clearAllMocks();
        jest.resetModules();

        const {
          ProductGeneratorService,
        } = require("../src/services/productGenerator");

        // Mock AppConfig to return the random config
        mockGetConfiguration.mockResolvedValueOnce(appConfig);

        // Mock ProductGeneratorService to capture the call args
        (
          ProductGeneratorService.prototype.generateProduct as jest.Mock
        ).mockResolvedValueOnce({
          productData: { title: "T", description: "D" },
        });

        const { handler } = require("../src/generate-product-sfn");
        await handler({ images: ["img.jpg"] });

        // Verify generateProduct was called
        expect(
          ProductGeneratorService.prototype.generateProduct,
        ).toHaveBeenCalledTimes(1);

        const callArgs = (
          ProductGeneratorService.prototype.generateProduct as jest.Mock
        ).mock.calls[0][0];

        // All values come from AppConfig
        expect(callArgs.model).toBe(appConfig.modelId);
        expect(callArgs.temperature).toBe(appConfig.temperature);
        expect(callArgs.language).toBe(appConfig.language);
        expect(callArgs.descriptionLength).toBe(appConfig.descriptionLength);
        expect(callArgs.examples).toEqual(appConfig.examples);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * When AppConfig returns null, all values should fall back to defaults.
   */
  it("should fall back to defaults when AppConfig returns null", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        jest.clearAllMocks();
        jest.resetModules();

        const {
          ProductGeneratorService,
        } = require("../src/services/productGenerator");

        mockGetConfiguration.mockResolvedValueOnce(null);

        (
          ProductGeneratorService.prototype.generateProduct as jest.Mock
        ).mockResolvedValueOnce({
          productData: { title: "T", description: "D" },
        });

        const { handler } = require("../src/generate-product-sfn");
        await handler({ images: ["img.jpg"] });

        const callArgs = (
          ProductGeneratorService.prototype.generateProduct as jest.Mock
        ).mock.calls[0][0];

        expect(callArgs.model).toBe("us.amazon.nova-lite-v1:0");
        expect(callArgs.temperature).toBe(0.1);
        expect(callArgs.language).toBeUndefined();
        expect(callArgs.descriptionLength).toBe("medium");
        expect(callArgs.examples).toEqual([]);
      }),
      { numRuns: 10 },
    );
  });
});
