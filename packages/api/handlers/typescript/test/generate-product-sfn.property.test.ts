/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Feature: appconfig-runtime-configuration, Property 6: AppConfig values take precedence over SSM for model and temperature
 * Validates: Requirements 6.2
 */

import fc from "fast-check";

// Mock dependencies
jest.mock("@aws-lambda-powertools/parameters/ssm");
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
 * Arbitrary for a full SSM config object
 */
const ssmConfigArb = fc.record({
  model: modelIdArb,
  temperature: temperatureArb,
  language: languageArb,
  descriptionLength: descriptionLengthArb,
  examples: examplesArb,
});

/**
 * Arbitrary for an AppConfig response (modelId, temperature)
 */
const appConfigArb = fc.record({
  modelId: modelIdArb,
  temperature: temperatureArb,
});

describe("Property 6: AppConfig values take precedence over SSM for model and temperature", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      IMAGE_BUCKET: "test-bucket",
      CONFIG_PARAM_NAME: "test-config-param",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * **Validates: Requirements 6.2**
   *
   * For any combination where both AppConfig provides a modelId/temperature
   * and the SSM Parameter Store config also contains model/temperature fields,
   * the Product Generation component must use the AppConfig values for model ID
   * and temperature while still using SSM values for language, descriptionLength,
   * and examples.
   */
  it("should use AppConfig modelId/temperature over SSM model/temperature, while preserving SSM language/descriptionLength/examples", async () => {
    await fc.assert(
      fc.asyncProperty(
        ssmConfigArb,
        appConfigArb,
        async (ssmConfig, appConfig) => {
          jest.clearAllMocks();
          jest.resetModules();

          // Re-require mocked modules after resetModules
          const {
            getParameter,
          } = require("@aws-lambda-powertools/parameters/ssm");
          const {
            ProductGeneratorService,
          } = require("../src/services/productGenerator");

          // Mock SSM to return the random SSM config
          (getParameter as jest.Mock).mockResolvedValueOnce(
            JSON.stringify(ssmConfig),
          );

          // Mock AppConfig to return the random AppConfig values
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

          // AppConfig values take precedence for model and temperature
          expect(callArgs.model).toBe(appConfig.modelId);
          expect(callArgs.temperature).toBe(appConfig.temperature);

          // SSM still provides language, descriptionLength, examples
          expect(callArgs.language).toBe(ssmConfig.language);
          expect(callArgs.descriptionLength).toBe(ssmConfig.descriptionLength);
          expect(callArgs.examples).toEqual(ssmConfig.examples);
        },
      ),
      { numRuns: 100 },
    );
  });
});
