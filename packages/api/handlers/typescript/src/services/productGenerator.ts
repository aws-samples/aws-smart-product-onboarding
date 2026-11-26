/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  BedrockRuntimeClient,
  ContentBlock,
  ImageBlock,
  ImageFormat,
  Message,
  TokenUsage,
} from "@aws-sdk/client-bedrock-runtime";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { ProductData, ProductGenerationContext } from "../types";
import { getStructuredOutput } from "./structuredOutput";
import { TemplateService } from "./templateService";
import { BadRequestError } from "../utils/exceptions";
import { logger } from "../utils/logger";

/** The model's answer. The prompt describes both fields. */
export const PRODUCT_SCHEMA = z.strictObject({
  title: z.string(),
  description: z.string(),
});

export class ProductGeneratorService {
  constructor(
    private s3Client: S3Client,
    private bedrockClient: BedrockRuntimeClient,
    private imageBucket: string,
    private templateService: TemplateService,
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
    const { prompt } = await this.preparePrompt({
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
    const { output, usage } = await getStructuredOutput({
      client: this.bedrockClient,
      modelId: model,
      message: prompt,
      schema: PRODUCT_SCHEMA,
      name: "product",
      temperature,
    });
    return { productData: output, usage };
  }

  /**
   * Prepare the prompt from the product generation template
   * @param props PreparePromptProps
   * @returns Promise<{ prompt: Message }>
   */
  private async preparePrompt(props: PreparePromptProps): Promise<{
    prompt: Message;
  }> {
    const { images, language, descriptionLength, metadata, examples } = props;
    const imageBlocks: ContentBlock[] = [];
    for (const image of images) {
      imageBlocks.push({
        image: image,
      });
    }

    const userPrompt = await this.renderPromptFromTemplate({
      language,
      descriptionLength,
      metadata,
      examples,
      imageCount: images.length,
    });

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

  /**
   * Render prompt using template system
   * @param params Template context parameters
   * @returns Promise<string> Rendered prompt
   */
  private async renderPromptFromTemplate(params: {
    language?: string;
    descriptionLength?: string;
    metadata?: string;
    examples?: ProductData[];
    imageCount: number;
  }): Promise<string> {
    const context = this.prepareTemplateContext(params);
    return this.templateService.render("product-generation", context);
  }

  /**
   * Prepare template context from parameters
   * @param params Input parameters
   * @returns ProductGenerationContext
   */
  private prepareTemplateContext(params: {
    language?: string;
    descriptionLength?: string;
    metadata?: string;
    examples?: ProductData[];
    imageCount: number;
  }): ProductGenerationContext {
    const { language, descriptionLength, metadata, examples, imageCount } =
      params;

    const paragraphCount = descriptionLength
      ? getParagraphCount(descriptionLength)
      : undefined;

    const context: ProductGenerationContext = {
      language,
      descriptionLength,
      paragraphCount,
      metadata,
      imageCount,
      conditionals: {
        hasExamples: Boolean(examples && examples.length > 0),
        hasMetadata: Boolean(metadata),
        hasDescriptionLength: Boolean(descriptionLength),
        hasLanguage: Boolean(language),
        isMultipleImages: imageCount > 1,
      },
    };

    // Add examples if provided
    if (examples && examples.length > 0) {
      context.examples = {
        formatted: formatExamples(examples),
        items: examples,
      };
    }

    return context;
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
