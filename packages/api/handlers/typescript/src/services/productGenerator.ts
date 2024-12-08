/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  BedrockRuntimeClient,
  ContentBlock,
  ConverseCommand,
  ImageBlock,
  ImageFormat,
  Message,
  TokenUsage,
} from "@aws-sdk/client-bedrock-runtime";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { XMLParser } from "fast-xml-parser";
import { ProductData } from "../types";
import { BadRequestError, ModelResponseError } from "../utils/exceptions";
import { logger } from "../utils/logger";

export class ProductGeneratorService {
  private readonly prefix = "<product>";
  private readonly suffix = "</product>";

  constructor(
    private s3Client: S3Client,
    private bedrockClient: BedrockRuntimeClient,
    private imageBucket: string,
  ) {}

  async generateProduct(params: {
    imageKeys: string[];
    language?: string;
    descriptionLength?: string;
    metadata?: string;
    examples?: ProductData[];
    model: string;
    temperature: number;
  }): Promise<{
    productData: ProductData;
    usage?: TokenUsage;
  }> {
    const images = await this.getImages(params.imageKeys);
    const { prompt } = preparePrompt({
      images,
      language: params.language,
      descriptionLength: params.descriptionLength,
      metadata: params.metadata,
      examples: params.examples,
    });

    return this.generateProductTitleAndDescription(
      params.model,
      params.temperature,
      prompt,
    );
  }

  /**
   * Call the LLM to create the title and description.
   * @param model
   * @param temperature
   * @param prompt
   * @returns GeneratedProduct
   */
  async generateProductTitleAndDescription(
    model: string,
    temperature: number,
    prompt: Message,
  ): Promise<{ productData: ProductData; usage?: TokenUsage }> {
    const converse = new ConverseCommand({
      messages: [
        prompt,
        { role: "assistant", content: [{ text: this.prefix }] },
      ],
      modelId: model,
      inferenceConfig: {
        temperature: temperature,
        maxTokens: 1024,
        stopSequences: [this.suffix],
      },
    });
    const response = await this.bedrockClient.send(converse);
    logger.debug(`Response: ${JSON.stringify(response)}`);

    const text = response.output?.message?.content?.[0]?.text;
    if (!text) {
      throw new ModelResponseError("Missing text in model output");
    }

    let productResponse: string;
    switch (response.stopReason) {
      case "stop_sequence":
        productResponse = `${this.prefix}${text}${this.suffix}`;
        break;
      case "end_turn":
        if (!text.endsWith(this.suffix)) {
          throw new ModelResponseError("Invalid model output");
        }
        productResponse = `${this.prefix}${text}`;
        break;
      default:
        throw new ModelResponseError("Invalid model output");
    }

    // Parse the XML response into an object.
    const productData = parseProductXml(productResponse);
    const usage = response.usage;
    return { productData, usage };
  }

  /**
   * Get images from S3 and prepare them for use in the model
   *
   * @param imageKeys
   * @returns Base64Image[]
   */
  private async getImages(imageKeys: string[]): Promise<ImageBlock[]> {
    const imagePromises = imageKeys.map(async (key): Promise<ImageBlock> => {
      const image = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.imageBucket,
          Key: key,
        }),
      );
      logger.debug(
        `Got ${key} with type ${image.ContentType} and size ${image.ContentLength}`,
      );
      if (!image.Body) {
        throw new BadRequestError(`Image ${key} has no body!`);
      }
      if (!image.ContentType) {
        throw new BadRequestError(`Image ${key} has no content type!`);
      }
      if (
        !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
          image.ContentType,
        )
      ) {
        throw new BadRequestError(
          `Image ${key} has an invalid content type: ${image.ContentType}!`,
        );
      }
      const data = await image.Body.transformToByteArray();
      return {
        source: { bytes: data },
        format: image.ContentType.slice(6) as ImageFormat,
      };
    });

    return Promise.all(imagePromises);
  }
}

export interface PreparePromptProps {
  images: ImageBlock[];
  language?: string;
  descriptionLength?: string;
  metadata?: string;
  examples?: ProductData[];
}

/**
 * Prepare the prompt
 * @param props PreparePromptProps
 * @returns Message
 */
export function preparePrompt(props: PreparePromptProps): {
  prompt: Message;
} {
  const { images, language, descriptionLength, metadata, examples } = props;
  const imageBlocks: ContentBlock[] = [];
  for (const image of images) {
    imageBlocks.push({
      image: image,
    });
  }
  const paragraphCount = descriptionLength
    ? getParagraphCount(descriptionLength)
    : "";

  let userPrompt = "";

  if (examples) {
    // nosemgrep: html-in-template-string - string is not rendered by a browser
    userPrompt += `<examples>\n${formatExamples(examples)}</examples>\n\n`;
  }

  // nosemgrep: html-in-template-string - string is not rendered by a browser
  userPrompt += `You are responsible for creating enticing and informative titles and descriptions for products on an e-commerce site. The products are targeted towards a general consumer audience and cover a wide range of categories, such as electronics, home goods, and apparel.

  Output Format:
  Please respond in the following XML format:
  
  <product>
      <title>Concise, engaging title. Include the brand name and/or product name if they known. (up to 60 characters)</title>
      <description>Informative description ${paragraphCount} highlighting key features, benefits, and use cases. Multiple paragraphs are separated by newline characters.</description>
  </product>
  
  Guidelines:
  - Title: Keep it short, clear, and attention-grabbing
  - Description: Emphasize the most important details about the product${
    examples
      ? `
  - Use the language, style, and tone demonstrated in <examples>`
      : `
  - Tone: Friendly and conversational, tailored to the target audience`
  }${
    descriptionLength
      ? `
  - Description length: ${paragraphCount}`
      : ""
  }
  - Any additional metadata or constraints will be provided in <metadata> tags
  - Respond in the above XML format with exactly one <product> that contains exactly one <title> and exactly one <description>. <title> and <description> contain only strings and no other tags.

  Please create a title and a description ${descriptionLength ? `with ${paragraphCount} ` : ""}${examples ? "following the language, style, and tone provided in <examples> " : ""}${language ? `in ${language} ` : ""} for the product shown in the ${
    images.length > 1 ? "images" : "image"
  }${metadata !== undefined ? " and metadata in <metadata>" : ""}.`;
  if (metadata) {
    // nosemgrep: html-in-template-string - string is not rendered by a browser
    userPrompt += `\n\n<metadata>${metadata}</metadata>`;
  }

  logger.debug(`Prompt: ${userPrompt}`);
  const prompt: Message = {
    role: "user",
    content: [
      ...imageBlocks,
      {
        text: userPrompt,
      },
    ],
  };

  return { prompt };
}

export function getParagraphCount(descriptionLength: string) {
  switch (descriptionLength) {
    case "short":
      return "one paragraph";
    case "medium":
      return "three paragraphs";
    case "long":
      return "five paragraphs";
    default:
      throw new BadRequestError(
        `Invalid description length: ${descriptionLength}`,
      );
  }
}

export function formatExamples(examples: ProductData[]): string {
  return examples
    .map(
      (example) =>
        `<product>\n<title>${example.title}</title>\n<description>${example.description}</description>\n</product>`,
    )
    .join("\n");
}

export function parseProductXml(xml: string): ProductData {
  const parser = new XMLParser();
  try {
    const doc = parser.parse(xml);
    return {
      title: doc.product.title! as string,
      description: doc.product.description! as string,
    };
  } catch (error) {
    logger.debug(`Error parsing product XML: ${xml}`);
    throw new ModelResponseError("Model output error");
  }
}
