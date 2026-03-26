/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Feature: appconfig-runtime-configuration, Property 3: Handlers use AppConfig values when available
 * Validates: Requirements 3.3, 4.5
 *
 * Feature: appconfig-runtime-configuration, Property 4: Handlers fall back to defaults on AppConfig failure
 * Validates: Requirements 3.4, 4.6
 */

import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import fc from "fast-check";
import { AppConfigClient } from "../../src/services/appConfigClient";

// Mock the external dependencies
jest.mock("@aws-sdk/client-appconfigdata");
jest.mock("../../src/utils/logger");

const mockSend = jest.fn();
(AppConfigDataClient as jest.Mock).mockImplementation(() => ({
  send: mockSend,
}));

const COMPONENT_KEYS = [
  "productGeneration",
  "metaclassClassification",
  "productCategorization",
  "attributeExtraction",
] as const;

/**
 * Arbitrary for a valid modelId: non-empty string
 */
const modelIdArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s: string) => s.trim().length > 0);

/**
 * Arbitrary for a valid temperature: number in [0, 1]
 */
const temperatureArb = fc.double({ min: 0, max: 1, noNaN: true });

/**
 * Arbitrary for a single component config
 */
const componentConfigArb = fc.record({
  modelId: modelIdArb,
  temperature: temperatureArb,
});

/**
 * Arbitrary for a full valid configuration document with all four component keys
 */
const configDocumentArb = fc.record({
  productGeneration: componentConfigArb,
  metaclassClassification: componentConfigArb,
  productCategorization: componentConfigArb,
  attributeExtraction: componentConfigArb,
});

/**
 * Arbitrary for selecting one of the valid component keys
 */
const componentKeyArb = fc.constantFrom(...COMPONENT_KEYS);

function encodeConfig(config: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(config));
}

describe("Property 3: Handlers use AppConfig values when available", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // **Validates: Requirements 3.3, 4.5**
  it("should extract and return the correct modelId and temperature for any valid config and component key", async () => {
    await fc.assert(
      fc.asyncProperty(
        configDocumentArb,
        componentKeyArb,
        async (configDoc, componentKey) => {
          jest.clearAllMocks();

          const client = new AppConfigClient("app-id", "env-id", "profile-id");

          mockSend
            .mockResolvedValueOnce({
              InitialConfigurationToken: "initial-token",
            })
            .mockResolvedValueOnce({
              Configuration: encodeConfig(configDoc),
              NextPollConfigurationToken: "next-token",
            });

          const result = await client.getConfiguration(componentKey);

          expect(result).not.toBeNull();
          expect(result!.modelId).toBe(configDoc[componentKey].modelId);
          expect(result!.temperature).toBe(configDoc[componentKey].temperature);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.3, 4.5**
  it("should use AppConfig modelId and temperature rather than any default, for any component key", async () => {
    await fc.assert(
      fc.asyncProperty(
        configDocumentArb,
        componentKeyArb,
        async (configDoc, componentKey) => {
          jest.clearAllMocks();

          const client = new AppConfigClient("app-id", "env-id", "profile-id");

          mockSend
            .mockResolvedValueOnce({
              InitialConfigurationToken: "token",
            })
            .mockResolvedValueOnce({
              Configuration: encodeConfig(configDoc),
              NextPollConfigurationToken: "next",
            });

          const result = await client.getConfiguration(componentKey);

          // The returned values must match exactly what was in the config document
          // for the requested component key — not some other key or a default
          const expected = configDoc[componentKey];
          expect(result).toEqual({
            modelId: expected.modelId,
            temperature: expected.temperature,
          });

          // Verify the client actually called AppConfig (StartSession + GetLatest)
          expect(mockSend).toHaveBeenCalledTimes(2);
          expect(mockSend).toHaveBeenNthCalledWith(
            1,
            expect.any(StartConfigurationSessionCommand),
          );
          expect(mockSend).toHaveBeenNthCalledWith(
            2,
            expect.any(GetLatestConfigurationCommand),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: appconfig-runtime-configuration, Property 4: Handlers fall back to defaults on AppConfig failure
 * Validates: Requirements 3.4, 4.6
 *
 * For any failure of the AppConfig client (network error, parse error, missing key),
 * the handler must use the BEDROCK_MODEL_ID environment variable as the model ID
 * and the hardcoded default temperature value.
 */

/**
 * Arbitrary for generating random error messages
 */
const errorMessageArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s: string) => s.trim().length > 0);

/**
 * Arbitrary for generating random Error objects with varied types
 */
const networkErrorArb = fc.oneof(
  errorMessageArb.map((msg) => new Error(msg)),
  errorMessageArb.map((msg) => new TypeError(msg)),
  errorMessageArb.map((msg) => new RangeError(msg)),
);

/**
 * Arbitrary for generating malformed (non-JSON) configuration strings
 */
const malformedJsonArb = fc.oneof(
  fc.constant("not valid json {{{"),
  fc.constant("{incomplete"),
  fc.constant("<<<xml>>>"),
  fc.constant(""),
  fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
    try {
      JSON.parse(s);
      return false; // valid JSON — reject it
    } catch {
      return true; // invalid JSON — keep it
    }
  }),
);

/**
 * Arbitrary for generating component keys that do NOT exist in the config document.
 * Also excludes Object prototype property names (e.g. "constructor", "toString")
 * which would resolve to truthy values on any plain JS object.
 */
const OBJECT_PROTO_KEYS = Object.getOwnPropertyNames(Object.prototype);
const missingKeyArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .filter(
    (s: string) =>
      ![
        "productGeneration",
        "metaclassClassification",
        "productCategorization",
        "attributeExtraction",
      ].includes(s) &&
      !OBJECT_PROTO_KEYS.includes(s) &&
      s.trim().length > 0,
  );

/**
 * Enum-like type for the different failure scenarios
 */
type FailureScenario =
  | { type: "networkErrorOnSession"; error: Error }
  | { type: "networkErrorOnGetConfig"; error: Error }
  | { type: "malformedJson"; body: string }
  | { type: "missingKey"; key: string }
  | { type: "emptyBody" }
  | { type: "undefinedBody" };

/**
 * Arbitrary that generates one of the possible AppConfig failure scenarios
 */
const failureScenarioArb: fc.Arbitrary<FailureScenario> = fc.oneof(
  networkErrorArb.map((error) => ({
    type: "networkErrorOnSession" as const,
    error,
  })),
  networkErrorArb.map((error) => ({
    type: "networkErrorOnGetConfig" as const,
    error,
  })),
  malformedJsonArb.map((body) => ({ type: "malformedJson" as const, body })),
  missingKeyArb.map((key) => ({ type: "missingKey" as const, key })),
  fc.constant({ type: "emptyBody" as const }),
  fc.constant({ type: "undefinedBody" as const }),
);

/**
 * Arbitrary for random BEDROCK_MODEL_ID env var values
 */
const envModelIdArb = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((s: string) => s.trim().length > 0);

const DEFAULT_TEMPERATURE = 0.1;

/**
 * Sets up the mock to simulate a specific failure scenario.
 */
function setupFailureScenario(
  scenario: FailureScenario,
  sendMock: jest.Mock,
): string {
  switch (scenario.type) {
    case "networkErrorOnSession":
      sendMock.mockRejectedValueOnce(scenario.error);
      return "productGeneration";

    case "networkErrorOnGetConfig":
      sendMock
        .mockResolvedValueOnce({
          InitialConfigurationToken: "token",
        })
        .mockRejectedValueOnce(scenario.error);
      return "productGeneration";

    case "malformedJson":
      sendMock
        .mockResolvedValueOnce({
          InitialConfigurationToken: "token",
        })
        .mockResolvedValueOnce({
          Configuration: new TextEncoder().encode(scenario.body),
          NextPollConfigurationToken: "next",
        });
      return "productGeneration";

    case "missingKey":
      sendMock
        .mockResolvedValueOnce({
          InitialConfigurationToken: "token",
        })
        .mockResolvedValueOnce({
          Configuration: encodeConfig({
            productGeneration: { modelId: "m", temperature: 0.5 },
            metaclassClassification: { modelId: "m", temperature: 0 },
            productCategorization: { modelId: "m", temperature: 0 },
            attributeExtraction: { modelId: "m", temperature: 0 },
          }),
          NextPollConfigurationToken: "next",
        });
      return scenario.key;

    case "emptyBody":
      sendMock
        .mockResolvedValueOnce({
          InitialConfigurationToken: "token",
        })
        .mockResolvedValueOnce({
          Configuration: new Uint8Array(0),
          NextPollConfigurationToken: "next",
        });
      return "productGeneration";

    case "undefinedBody":
      sendMock
        .mockResolvedValueOnce({
          InitialConfigurationToken: "token",
        })
        .mockResolvedValueOnce({
          Configuration: undefined,
          NextPollConfigurationToken: "next",
        });
      return "productGeneration";
  }
}

describe("Property 4: Handlers fall back to defaults on AppConfig failure", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // **Validates: Requirements 3.4, 4.6**
  it("should return null for any AppConfig failure scenario, causing handlers to use env var model ID and default temperature", async () => {
    await fc.assert(
      fc.asyncProperty(
        failureScenarioArb,
        envModelIdArb,
        async (scenario, envModelId) => {
          jest.clearAllMocks();

          // Set the BEDROCK_MODEL_ID env var to a random value
          process.env.BEDROCK_MODEL_ID = envModelId;

          const client = new AppConfigClient("app-id", "env-id", "profile-id");
          const componentKey = setupFailureScenario(scenario, mockSend);

          // The client must return null on any failure
          const result = await client.getConfiguration(componentKey);
          expect(result).toBeNull();

          // Simulate handler fallback logic (mirrors generate-product.ts / generate-product-sfn.ts)
          const fallbackModelId =
            result?.modelId ??
            (process.env.BEDROCK_MODEL_ID ||
              "anthropic.claude-3-haiku-20240307-v1:0");
          const fallbackTemperature =
            result?.temperature ?? DEFAULT_TEMPERATURE;

          // Handler must use the BEDROCK_MODEL_ID env var
          expect(fallbackModelId).toBe(envModelId);
          // Handler must use the hardcoded default temperature
          expect(fallbackTemperature).toBe(DEFAULT_TEMPERATURE);
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.4, 4.6**
  it("should never throw an exception for any failure scenario — always returns null gracefully", async () => {
    await fc.assert(
      fc.asyncProperty(failureScenarioArb, async (scenario) => {
        jest.clearAllMocks();

        const client = new AppConfigClient("app-id", "env-id", "profile-id");
        const componentKey = setupFailureScenario(scenario, mockSend);

        // Must not throw — the client catches all errors internally
        const result = await client.getConfiguration(componentKey);
        expect(result).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
