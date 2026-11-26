/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  BedrockRuntimeClient,
  ContentBlock,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
  Message,
  TokenUsage,
  ValidationException,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import { supportsTemperature } from "./modelCapabilities";
import { ContentFilteredError, ModelResponseError } from "../utils/exceptions";
import { logger } from "../utils/logger";

// One retry when the answer doesn't match the schema.
const OUTPUT_RETRIES = 1;
// Reasoning models count thinking tokens against this limit.
const MAX_TOKENS = 4096;
const CONTENT_FILTER_STOP_REASONS = [
  "content_filtered",
  "guardrail_intervened",
];
// Bedrock requires tool property names to match this.
const SAFE_KEY = /^[a-zA-Z0-9_.-]{1,64}$/;
// Bedrock's answer to outputConfig from a model without JSON schema output.
const JSON_SCHEMA_OUTPUT_UNSUPPORTED = [
  "doesn't support the outputConfig field",
  "output_config.format: Extra inputs are not permitted",
];

// Models that rejected outputConfig, kept for the life of the process so later requests use the tool directly.
const modelsWithoutJsonSchemaOutput = new Set<string>();

/**
 * Amazon Nova models reject outputConfig, so they get the forced tool call without a rejected request first.
 * Other models get outputConfig, and fall back to the forced tool call when Bedrock rejects it.
 */
export function supportsJsonSchemaOutput(modelId: string): boolean {
  return (
    !/amazon\.nova-/.test(modelId) &&
    !modelsWithoutJsonSchemaOutput.has(modelId)
  );
}

/** For tests: forget the models that rejected outputConfig. */
export function resetJsonSchemaOutputSupport(): void {
  modelsWithoutJsonSchemaOutput.clear();
}

/** The JSON schema Bedrock gets for a zod object schema. */
export function jsonSchema(schema: z.ZodObject): Record<string, unknown> {
  const { $schema: _, ...json } = z.toJSONSchema(schema);
  const keys = Object.keys(schema.shape);
  const unsafe = keys.filter((key) => !SAFE_KEY.test(key));
  if (unsafe.length > 0) {
    throw new Error(`Schema property names Bedrock refuses: ${unsafe}`);
  }
  return json;
}

class InvalidAnswer extends Error {
  /** `feedback` goes back to the model with the retry and can quote its answer; it is never logged. */
  constructor(
    readonly feedback: string,
    readonly log: Record<string, unknown>,
  ) {
    super(feedback);
  }
}

function addUsage(
  total: TokenUsage | undefined,
  usage: TokenUsage | undefined,
): TokenUsage | undefined {
  if (!total || !usage) {
    return usage ?? total;
  }
  return {
    inputTokens: (total.inputTokens ?? 0) + (usage.inputTokens ?? 0),
    outputTokens: (total.outputTokens ?? 0) + (usage.outputTokens ?? 0),
    totalTokens: (total.totalTokens ?? 0) + (usage.totalTokens ?? 0),
  };
}

function isJsonSchemaOutputRejection(error: unknown): boolean {
  return (
    error instanceof ValidationException &&
    JSON_SCHEMA_OUTPUT_UNSUPPORTED.some((signal) =>
      error.message.includes(signal),
    )
  );
}

function answerOf(
  response: ConverseCommandOutput,
  toolName: string | undefined,
): unknown {
  // A blocked response may have no content at all, so check this before reading it.
  if (CONTENT_FILTER_STOP_REASONS.includes(response.stopReason ?? "")) {
    logger.warn(`Content filter stopped the model: ${response.stopReason}`);
    throw new ContentFilteredError();
  }
  const content = response.output?.message?.content ?? [];
  if (toolName) {
    const toolUse = content.find(
      (block) => block.toolUse?.name === toolName,
    )?.toolUse;
    if (!toolUse) {
      throw new InvalidAnswer(`Answer with the ${toolName} tool.`, {
        stopReason: response.stopReason,
      });
    }
    // Any other stop, such as max_tokens, can leave the tool input cut off.
    if (response.stopReason !== "tool_use") {
      throw new InvalidAnswer(
        `The answer was incomplete (stop reason ${response.stopReason}).`,
        { stopReason: response.stopReason },
      );
    }
    return toolUse.input;
  }
  // Reasoning models put a reasoningContent block before the text block.
  const text = content.find((block) => block.text !== undefined)?.text;
  if (response.stopReason !== "end_turn" || !text) {
    throw new InvalidAnswer("Answer with the structured output only.", {
      stopReason: response.stopReason,
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidAnswer("The answer is not valid JSON.", {
      stopReason: response.stopReason,
      answerLength: text.length,
    });
  }
}

/**
 * Ask a Bedrock model, through Converse, for an answer that matches `schema`.
 *
 * Models with JSON schema output get the schema in outputConfig, and Bedrock constrains the answer to it. Models
 * without it, such as Amazon Nova, get a forced call to a tool whose input is the schema; Bedrock doesn't check that
 * input, so every answer is validated here, and an answer that doesn't match gets one retry.
 *
 * @throws ContentFilteredError A content filter or guardrail stopped the model.
 * @throws ModelResponseError The answer still didn't match the schema after the retry, or was incomplete.
 * Bedrock errors are thrown unchanged, so callers can map throttling and validation errors.
 */
export async function getStructuredOutput<T extends z.ZodObject>(params: {
  client: BedrockRuntimeClient;
  modelId: string;
  message: Message;
  schema: T;
  name: string;
  temperature: number;
}): Promise<{ output: z.infer<T>; usage?: TokenUsage }> {
  const { client, modelId, message, schema, name, temperature } = params;
  const json = jsonSchema(schema);
  let usage: TokenUsage | undefined;
  let feedback: string | undefined;

  for (let attempt = 0; attempt <= OUTPUT_RETRIES; attempt++) {
    const content: ContentBlock[] = [...(message.content ?? [])];
    if (feedback) {
      content.push({
        text: `Your previous answer was rejected. ${feedback}`,
      });
    }
    const request: ConverseCommandInput = {
      modelId,
      messages: [{ role: message.role, content }],
      inferenceConfig: {
        maxTokens: MAX_TOKENS,
        // Claude 4.7 and later reject temperature.
        ...(supportsTemperature(modelId) && { temperature }),
      },
    };
    try {
      let response: ConverseCommandOutput;
      let toolName: string | undefined;
      if (supportsJsonSchemaOutput(modelId)) {
        try {
          response = await client.send(
            new ConverseCommand({
              ...request,
              outputConfig: {
                textFormat: {
                  type: "json_schema",
                  structure: {
                    jsonSchema: { schema: JSON.stringify(json), name },
                  },
                },
              },
            }),
          );
        } catch (error) {
          if (!isJsonSchemaOutputRejection(error)) {
            throw error;
          }
          logger.warn("Model rejects outputConfig", { modelId });
          modelsWithoutJsonSchemaOutput.add(modelId);
          toolName = name;
          response = await client.send(forcedToolCommand(request, name, json));
        }
      } else {
        toolName = name;
        response = await client.send(forcedToolCommand(request, name, json));
      }
      usage = addUsage(usage, response.usage);
      const answer = answerOf(response, toolName);
      const parsed = schema.safeParse(answer);
      if (!parsed.success) {
        throw new InvalidAnswer(
          `The answer does not match the schema: ${parsed.error.issues
            .map(
              (issue) =>
                `${issue.path.join("/") || "<root>"}: ${issue.message}`,
            )
            .join("; ")}`,
          // The path and code, without the message: it can quote an unknown key the model wrote.
          {
            errors: parsed.error.issues.map(
              (issue) => `${issue.path.join("/") || "<root>"}: ${issue.code}`,
            ),
          },
        );
      }
      logger.info("Model usage", { usage });
      return { output: parsed.data, usage };
    } catch (error) {
      if (!(error instanceof InvalidAnswer)) {
        throw error;
      }
      logger.warn("Answer does not match the schema", {
        schema: name,
        attempt: attempt + 1,
        ...error.log,
      });
      feedback = error.feedback;
    }
  }
  throw new ModelResponseError(`No valid ${name} answer`);
}

function forcedToolCommand(
  request: ConverseCommandInput,
  name: string,
  json: Record<string, unknown>,
): ConverseCommand {
  return new ConverseCommand({
    ...request,
    toolConfig: {
      tools: [
        {
          toolSpec: {
            name,
            description: `Give the ${name} answer.`,
            // The SDK types the schema as a DocumentType.
            inputSchema: { json: json as never },
          },
        },
      ],
      toolChoice: { tool: { name } },
    },
  });
}
