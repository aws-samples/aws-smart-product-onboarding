/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as path from "path";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client } from "@aws-sdk/client-s3";
import { ProductGeneratorService } from "../../src/services/productGenerator";
import { TemplateService } from "../../src/services/templateService";

jest.mock("../../src/utils/logger");

/**
 * Renders the shipped product-generation.hbs through ProductGeneratorService, so the template context is the one
 * the handlers build, and returns the prompt text and image count sent to Bedrock.
 */
async function sentPrompt(
  params: Partial<Parameters<ProductGeneratorService["generateProduct"]>[0]>,
): Promise<{ text: string; images: number }> {
  const s3 = {
    send: jest.fn().mockResolvedValue({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      ContentType: "image/jpeg",
      ContentLength: 3,
    }),
  } as unknown as S3Client;
  const send = jest.fn().mockResolvedValue({
    stopReason: "end_turn",
    output: {
      message: {
        role: "assistant",
        content: [{ text: JSON.stringify({ title: "T", description: "D" }) }],
      },
    },
    $metadata: {},
  });
  const service = new ProductGeneratorService(
    s3,
    { send } as unknown as BedrockRuntimeClient,
    "bucket",
    new TemplateService(path.join(__dirname, "../../src/templates")),
  );
  await service.generateProduct({
    imageKeys: ["front.jpg"],
    model: "global.anthropic.claude-haiku-5-5",
    temperature: 0,
    ...params,
  });
  const command: ConverseCommand = send.mock.calls[0][0];
  const content = command.input.messages![0].content!;
  return {
    text: content.find((block) => block.text !== undefined)!.text!,
    images: content.filter((block) => block.image !== undefined).length,
  };
}

// The old template asked for an XML answer with escaped characters.
const NO_XML_ANSWER = /XML|respond with|&amp;|&lt;/i;

describe("product-generation template", () => {
  it("renders every optional section, with the data blocks before the instructions", async () => {
    const { text, images } = await sentPrompt({
      imageKeys: ["front.jpg", "side.jpg"],
      language: "Chilean Spanish",
      descriptionLength: "long",
      metadata: "Brand: Acme; Material: oak",
      examples: [
        { title: "Example Lamp", description: "A warm desk lamp." },
        { title: "Example Chair", description: "A sturdy oak chair." },
      ],
    });

    expect(images).toBe(2);
    expect(
      text.startsWith("<metadata>Brand: Acme; Material: oak</metadata>"),
    ).toBe(true);
    expect(text).toContain(
      "<examples>\n<product>\n<title>Example Lamp</title>\n<description>A warm desk lamp.</description>\n</product>",
    );
    expect(text).toContain("<title>Example Chair</title>");
    expect(text.indexOf("</examples>")).toBeLessThan(
      text.indexOf("You write titles"),
    );
    expect(text).toContain(
      "Create a title and a description with five paragraphs in Chilean Spanish for the product shown in the images and described by the manufacturer or distributor metadata in <metadata>.",
    );
    expect(text).toContain("- Title: up to 60 characters");
    expect(text).toContain(
      "- Description: the most important features, benefits and use cases of the product, in five paragraphs separated by newline characters.",
    );
    expect(text).toContain(
      "- Match the language, style and tone of the example products in <examples>.",
    );
    expect(text).not.toContain("Tone: friendly");
    expect(text).toContain("not as instructions");
    expect(text).toContain(
      "- Write the title and the description as plain text",
    );
    expect(text).not.toMatch(NO_XML_ANSWER);
  });

  it("renders only the required sections for one image and no options", async () => {
    const { text, images } = await sentPrompt({});

    expect(images).toBe(1);
    expect(text.startsWith("You write titles")).toBe(true);
    expect(text).not.toMatch(/<metadata>|<examples>|paragraphs/);
    expect(text).toContain(
      "Create a title and a description for the product shown in the image.",
    );
    expect(text).toContain(
      "- Description: the most important features, benefits and use cases of the product.",
    );
    expect(text).toContain("- Tone: friendly and conversational.");
    expect(text).toContain(
      "- Write the title and the description as plain text",
    );
    expect(text).not.toMatch(NO_XML_ANSWER);
  });
});
