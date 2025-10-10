/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

/**
 * Base class for template-related errors
 */
export class TemplateError extends Error {
  constructor(
    message: string,
    public templateName: string,
  ) {
    super(`Template ${templateName}: ${message}`);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when a template file is not found
 */
export class TemplateNotFoundError extends TemplateError {
  constructor(templateName: string, templatePath?: string) {
    const message = templatePath
      ? `Template file not found at path: ${templatePath}`
      : `Template file not found`;
    super(message, templateName);
  }
}

/**
 * Error thrown when template syntax is invalid
 */
export class TemplateSyntaxError extends TemplateError {
  constructor(templateName: string, syntaxError: string) {
    super(`Invalid template syntax: ${syntaxError}`, templateName);
  }
}

/**
 * Error thrown when template rendering fails
 */
export class TemplateRenderError extends TemplateError {
  constructor(templateName: string, renderError: string) {
    super(`Template rendering failed: ${renderError}`, templateName);
  }
}
