/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as Handlebars from "handlebars";

export interface ProductData {
  title: string;
  description: string;
}

export type ImageTypes =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

/**
 * Context interface for product generation templates
 * Contains all variables needed for template rendering
 */
export interface ProductGenerationContext {
  /** Optional examples for style and tone guidance */
  examples?: {
    /** Formatted examples string for template rendering */
    formatted: string;
    /** Array of example product data */
    items: ProductData[];
  };
  /** Optional language specification for generated content */
  language?: string;
  /** Optional description length specification (short, medium, long) */
  descriptionLength?: string;
  /** Optional paragraph count description for template rendering */
  paragraphCount?: string;
  /** Optional metadata string to include in prompt */
  metadata?: string;
  /** Number of images being processed */
  imageCount: number;
  /** Conditional flags for template logic */
  conditionals: {
    /** Whether examples are provided */
    hasExamples: boolean;
    /** Whether metadata is provided */
    hasMetadata: boolean;
    /** Whether description length is specified */
    hasDescriptionLength: boolean;
    /** Whether language is specified */
    hasLanguage: boolean;
    /** Whether multiple images are being processed */
    isMultipleImages: boolean;
  };
}

/**
 * Generic template context interface for structured template data
 * Can be extended for different template types
 */
export interface TemplateContext {
  /** Dynamic properties for template variables */
  [key: string]: any;
}

/**
 * Template service method signatures and types
 */
export interface TemplateServiceMethods {
  /**
   * Load a template from the file system and compile it
   * @param templateName - Name of the template file (without .hbs extension)
   * @returns Promise resolving to compiled Handlebars template
   */
  loadTemplate(templateName: string): Promise<Handlebars.TemplateDelegate>;

  /**
   * Render a template with the provided context
   * @param templateName - Name of the template to render
   * @param context - Data to pass to the template
   * @returns Promise resolving to rendered template string
   */
  render(templateName: string, context: any): Promise<string>;

  /**
   * Clear the template cache
   */
  clearCache(): void;

  /**
   * Get the number of cached templates
   * @returns Number of cached templates
   */
  getCacheSize(): number;

  /**
   * Check if a template is cached
   * @param templateName - Name of the template to check
   * @returns true if template is cached, false otherwise
   */
  isCached(templateName: string): boolean;

  /**
   * Get the template directory path
   * @returns Template directory path
   */
  getTemplateDir(): string;
}
