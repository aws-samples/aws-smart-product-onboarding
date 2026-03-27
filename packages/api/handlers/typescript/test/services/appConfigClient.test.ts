/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from "@aws-sdk/client-appconfigdata";
import { AppConfigClient } from "../../src/services/appConfigClient";

// Mock the external dependencies
jest.mock("@aws-sdk/client-appconfigdata");
jest.mock("../../src/utils/logger");

const mockSend = jest.fn();
(AppConfigDataClient as jest.Mock).mockImplementation(() => ({
  send: mockSend,
}));

const VALID_CONFIG = {
  productGeneration: {
    modelId: "us.amazon.nova-lite-v1:0",
    temperature: 0.1,
  },
  metaclassClassification: {
    modelId: "us.amazon.nova-micro-v1:0",
    temperature: 0,
  },
  productCategorization: {
    modelId: "us.anthropic.claude-3-haiku-20240307-v1:0",
    temperature: 0,
  },
  attributeExtraction: {
    modelId: "us.amazon.nova-premier-v1:0",
    temperature: 0,
  },
};

function encodeConfig(config: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(config));
}

describe("AppConfigClient", () => {
  let client: AppConfigClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AppConfigClient("app-id", "env-id", "profile-id");
  });

  describe("successful retrieval", () => {
    it("should start a session and return configuration for a valid component key", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: encodeConfig(VALID_CONFIG),
          NextPollConfigurationToken: "next-token",
        });

      const result = await client.getConfiguration("productGeneration");

      expect(result).toEqual({
        modelId: "us.amazon.nova-lite-v1:0",
        temperature: 0.1,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenNthCalledWith(
        1,
        expect.any(StartConfigurationSessionCommand),
      );
      expect(mockSend).toHaveBeenNthCalledWith(
        2,
        expect.any(GetLatestConfigurationCommand),
      );
    });
  });

  describe("session token reuse", () => {
    it("should reuse the session token on subsequent calls instead of starting a new session", async () => {
      // First call: starts session + gets config
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: encodeConfig(VALID_CONFIG),
          NextPollConfigurationToken: "next-token-1",
        });

      await client.getConfiguration("productGeneration");
      expect(mockSend).toHaveBeenCalledTimes(2);

      mockSend.mockClear();

      // Second call: should only call GetLatestConfiguration (no new session)
      mockSend.mockResolvedValueOnce({
        Configuration: encodeConfig(VALID_CONFIG),
        NextPollConfigurationToken: "next-token-2",
      });

      const result = await client.getConfiguration("metaclassClassification");

      expect(result).toEqual({
        modelId: "us.amazon.nova-micro-v1:0",
        temperature: 0,
      });

      // Only one call — no StartConfigurationSession
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.any(GetLatestConfigurationCommand),
      );
    });
  });

  describe("empty body (no config deployed)", () => {
    it("should return null when Configuration is empty", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: new Uint8Array(0),
          NextPollConfigurationToken: "next-token",
        });

      const result = await client.getConfiguration("productGeneration");

      expect(result).toBeNull();
    });

    it("should return null when Configuration is undefined", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: undefined,
          NextPollConfigurationToken: "next-token",
        });

      const result = await client.getConfiguration("productGeneration");

      expect(result).toBeNull();
    });
  });

  describe("network error", () => {
    it("should return null on network error and reset session token", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockRejectedValueOnce(new Error("Network timeout"));

      const result = await client.getConfiguration("productGeneration");

      expect(result).toBeNull();

      // After error, session token is reset — next call should start a new session
      mockSend.mockClear();
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "fresh-token",
        })
        .mockResolvedValueOnce({
          Configuration: encodeConfig(VALID_CONFIG),
          NextPollConfigurationToken: "next-token",
        });

      const retryResult = await client.getConfiguration("productGeneration");
      expect(retryResult).not.toBeNull();
      // Should have called StartConfigurationSession again
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend).toHaveBeenNthCalledWith(
        1,
        expect.any(StartConfigurationSessionCommand),
      );
    });

    it("should return null when StartConfigurationSession fails", async () => {
      mockSend.mockRejectedValueOnce(new Error("Service unavailable"));

      const result = await client.getConfiguration("productGeneration");

      expect(result).toBeNull();
    });
  });

  describe("malformed JSON", () => {
    it("should return null when configuration body is not valid JSON", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: new TextEncoder().encode("not valid json {{{"),
          NextPollConfigurationToken: "next-token",
        });

      const result = await client.getConfiguration("productGeneration");

      expect(result).toBeNull();
    });
  });

  describe("missing component key", () => {
    it("should return null when the requested component key does not exist in the config", async () => {
      mockSend
        .mockResolvedValueOnce({
          InitialConfigurationToken: "initial-token",
        })
        .mockResolvedValueOnce({
          Configuration: encodeConfig(VALID_CONFIG),
          NextPollConfigurationToken: "next-token",
        });

      const result = await client.getConfiguration("nonExistentComponent");

      expect(result).toBeNull();
    });
  });
});
