/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseCommandInput,
  ConverseCommandOutput,
  ThrottlingException,
  ValidationException,
} from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";
import {
  getStructuredOutput,
  jsonSchema,
  resetJsonSchemaOutputSupport,
} from "../../src/services/structuredOutput";
import {
  ContentFilteredError,
  ModelResponseError,
} from "../../src/utils/exceptions";

jest.mock("../../src/utils/logger");

const CLAUDE = "global.anthropic.claude-haiku-5-5";
const NOVA = "global.amazon.nova-2-lite-v1:0";
const SCHEMA = z.strictObject({ title: z.string(), description: z.string() });
const ANSWER = { title: "T", description: "D" };
const meta = { $metadata: {} };

function text(value: string, stopReason = "end_turn"): ConverseCommandOutput {
  return {
    stopReason,
    output: { message: { role: "assistant", content: [{ text: value }] } },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    ...meta,
  } as unknown as ConverseCommandOutput;
}

function tool(input: unknown, stopReason = "tool_use"): ConverseCommandOutput {
  return {
    stopReason,
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: { toolUseId: "1", name: "product", input: input as never },
          },
        ],
      },
    },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    ...meta,
  } as unknown as ConverseCommandOutput;
}

describe("getStructuredOutput", () => {
  let send: jest.Mock;
  const requests = (): ConverseCommandInput[] =>
    send.mock.calls.map(([command]: [ConverseCommand]) => command.input);
  const ask = (modelId: string) =>
    getStructuredOutput({
      client: { send } as unknown as BedrockRuntimeClient,
      modelId,
      message: { role: "user", content: [{ text: "prompt" }] },
      schema: SCHEMA,
      name: "product",
      temperature: 0.3,
    });

  beforeEach(() => {
    send = jest.fn();
    resetJsonSchemaOutputSupport();
  });

  it("asks Claude for JSON schema output on Converse, without temperature, prefill or tools", async () => {
    send.mockResolvedValueOnce(text(JSON.stringify(ANSWER)));

    const result = await ask(CLAUDE);

    expect(result.output).toEqual(ANSWER);
    const [request] = requests();
    expect(send.mock.calls[0][0]).toBeInstanceOf(ConverseCommand);
    expect(request.messages).toHaveLength(1);
    expect(request.inferenceConfig).toEqual({ maxTokens: 4096 });
    expect(request.toolConfig).toBeUndefined();
    const format = request.outputConfig!.textFormat!;
    expect(format.type).toBe("json_schema");
    expect(
      JSON.parse(
        (format.structure as { jsonSchema: { schema: string } }).jsonSchema
          .schema,
      ),
    ).toEqual(jsonSchema(SCHEMA));
  });

  it("forces a tool call with the schema on Nova, with temperature", async () => {
    send.mockResolvedValueOnce(tool(ANSWER));

    const result = await ask(NOVA);

    expect(result.output).toEqual(ANSWER);
    const [request] = requests();
    expect(request.outputConfig).toBeUndefined();
    expect(request.inferenceConfig?.temperature).toBe(0.3);
    expect(request.toolConfig?.toolChoice).toEqual({
      tool: { name: "product" },
    });
    expect(request.toolConfig?.tools?.[0].toolSpec?.inputSchema?.json).toEqual(
      jsonSchema(SCHEMA),
    );
  });

  it("falls back to the forced tool when a model rejects outputConfig, and remembers it", async () => {
    const model = "us.anthropic.claude-3-haiku-20240307-v1:0";
    send
      .mockRejectedValueOnce(
        new ValidationException({
          message: "This model doesn't support the outputConfig field.",
          ...meta,
        }),
      )
      .mockResolvedValueOnce(tool(ANSWER))
      .mockResolvedValueOnce(tool(ANSWER));

    expect((await ask(model)).output).toEqual(ANSWER);
    expect((await ask(model)).output).toEqual(ANSWER);

    const sent = requests();
    expect(sent).toHaveLength(3);
    expect(sent[0].outputConfig).toBeDefined();
    expect(sent[1].toolConfig).toBeDefined();
    expect(sent[2].outputConfig).toBeUndefined();
    expect(sent[2].toolConfig).toBeDefined();
  });

  it.each([
    ["an extra key", { ...ANSWER, price: "1" }],
    ["a missing field", { title: "T" }],
    ["a wrong type", { title: "T", description: 1 }],
  ])(
    "retries once with the errors when the answer has %s",
    async (_, wrong) => {
      send
        .mockResolvedValueOnce(tool(wrong))
        .mockResolvedValueOnce(tool(ANSWER));

      const result = await ask(NOVA);

      expect(result.output).toEqual(ANSWER);
      expect(result.usage).toEqual({
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      });
      const retry = requests()[1].messages![0].content!;
      expect(retry.at(-1)?.text).toContain("does not match the schema");
    },
  );

  it("throws ModelResponseError after a second mismatch", async () => {
    send.mockResolvedValue(tool({ title: "T" }));

    await expect(ask(NOVA)).rejects.toThrow(ModelResponseError);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "an answer cut off at max_tokens",
      CLAUDE,
      text('{"title": "T"', "max_tokens"),
      text(JSON.stringify(ANSWER)),
    ],
    ["invalid JSON", CLAUDE, text("not json"), text(JSON.stringify(ANSWER))],
    ["no tool call", NOVA, text("Here is the product."), tool(ANSWER)],
    [
      "a tool call cut off at max_tokens",
      NOVA,
      tool({ title: "T", description: "Cut o" }, "max_tokens"),
      tool(ANSWER),
    ],
  ])("retries %s", async (_, model, first, second) => {
    send.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    expect((await ask(model)).output).toEqual(ANSWER);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("throws ModelResponseError after two tool calls cut off at max_tokens", async () => {
    send.mockResolvedValue(tool(ANSWER, "max_tokens"));

    await expect(ask(NOVA)).rejects.toThrow(ModelResponseError);
    expect(send).toHaveBeenCalledTimes(2);
    const retry = requests()[1].messages![0].content!;
    expect(retry.at(-1)?.text).toContain("stop reason max_tokens");
  });

  it.each(["content_filtered", "guardrail_intervened"])(
    "throws ContentFilteredError without a retry when the stop reason is %s",
    async (stopReason) => {
      send.mockResolvedValue({
        stopReason,
        output: { message: { role: "assistant", content: [] } },
        ...meta,
      });

      await expect(ask(CLAUDE)).rejects.toThrow(ContentFilteredError);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    new ThrottlingException({ message: "slow down", ...meta }),
    new ValidationException({ message: "bad image", ...meta }),
  ])("throws other Bedrock errors unchanged: %s", async (error) => {
    send.mockRejectedValue(error);

    await expect(ask(CLAUDE)).rejects.toBe(error);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("jsonSchema", () => {
  it("leaves out $schema", () => {
    expect(jsonSchema(SCHEMA)).not.toHaveProperty("$schema");
  });

  it("refuses property names Bedrock rejects in a tool schema", () => {
    expect(() =>
      jsonSchema(z.strictObject({ "Type of Material": z.string() })),
    ).toThrow("Type of Material");
  });
});
