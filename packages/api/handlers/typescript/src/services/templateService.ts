/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";
import {
  TemplateError,
  TemplateNotFoundError,
  TemplateSyntaxError,
  TemplateRenderError,
} from "./templateErrors";
import { TemplateServiceMethods, TemplateContext } from "../types";
import { logger } from "../utils/logger";

/**
 * Service for managing Handlebars templates with loading, caching, and rendering capabilities
 */
export class TemplateService implements TemplateServiceMethods {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templateDir: string;

  constructor(templateDir: string) {
    this.templateDir = path.resolve(templateDir);
    logger.debug(
      `TemplateService initialized with template directory: ${this.templateDir}`,
    );
  }

  /**
   * Load a template from the file system and compile it
   * Templates are cached after first load for performance
   *
   * @param templateName - Name of the template file (without .hbs extension)
   * @returns Compiled Handlebars template
   * @throws TemplateNotFoundError if template file doesn't exist
   * @throws TemplateSyntaxError if template has invalid syntax
   */
  async loadTemplate(
    templateName: string,
  ): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    const cachedTemplate = this.templates.get(templateName);
    if (cachedTemplate) {
      logger.debug(`Template ${templateName} loaded from cache`);
      return cachedTemplate;
    }

    const templatePath = path.join(this.templateDir, `${templateName}.hbs`);

    try {
      // Check if file exists
      if (!fs.existsSync(templatePath)) {
        throw new TemplateNotFoundError(templateName, templatePath);
      }

      // Read template file
      const templateContent = fs.readFileSync(templatePath, "utf-8");
      logger.debug(
        `Template ${templateName} loaded from file: ${templatePath}`,
      );

      // Compile template
      let compiledTemplate: HandlebarsTemplateDelegate;
      try {
        compiledTemplate = Handlebars.compile(templateContent, {
          strict: false, // Allow undefined variables to render as empty strings
          noEscape: false, // Allow HTML escaping by default
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new TemplateSyntaxError(templateName, errorMessage);
      }

      // Cache the compiled template
      this.templates.set(templateName, compiledTemplate);
      logger.debug(`Template ${templateName} compiled and cached successfully`);

      return compiledTemplate;
    } catch (error) {
      if (error instanceof TemplateError) {
        throw error;
      }

      // Handle unexpected file system errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TemplateNotFoundError(
        templateName,
        `File system error: ${errorMessage}`,
      );
    }
  }

  /**
   * Render a template with the provided context
   *
   * @param templateName - Name of the template to render
   * @param context - Data to pass to the template
   * @returns Rendered template as string
   * @throws TemplateNotFoundError if template doesn't exist
   * @throws TemplateSyntaxError if template has invalid syntax
   * @throws TemplateRenderError if rendering fails
   */
  async render(templateName: string, context: any): Promise<string> {
    try {
      const template = await this.loadTemplate(templateName);

      // Validate context is an object
      if (context !== null && typeof context !== "object") {
        throw new TemplateRenderError(
          templateName,
          "Context must be an object",
        );
      }

      const rendered = template(context);
      logger.debug(`Template ${templateName} rendered successfully`);

      return rendered;
    } catch (error) {
      if (error instanceof TemplateError) {
        throw error;
      }

      // Handle Handlebars runtime errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TemplateRenderError(templateName, errorMessage);
    }
  }

  /**
   * Clear the template cache
   * Useful for testing or when templates are updated at runtime
   */
  clearCache(): void {
    this.templates.clear();
    logger.debug("Template cache cleared");
  }

  /**
   * Get the number of cached templates
   * Useful for monitoring and testing
   */
  getCacheSize(): number {
    return this.templates.size;
  }

  /**
   * Check if a template is cached
   *
   * @param templateName - Name of the template to check
   * @returns true if template is cached, false otherwise
   */
  isCached(templateName: string): boolean {
    return this.templates.has(templateName);
  }

  /**
   * Get the template directory path
   */
  getTemplateDir(): string {
    return this.templateDir;
  }
}
