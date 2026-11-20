/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

export class RetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class ModelResponseError extends RetryableError {
  constructor(message: string) {
    super(message);
    this.name = "ModelResponseError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export const CONTENT_FILTERED_MESSAGE =
  "Blocked by the model's content filter. Edit the product details or images and try again.";

/**
 * The model stopped because a content filter or guardrail blocked the request or the response.
 * Not a RetryableError: the same input is blocked again.
 */
export class ContentFilteredError extends Error {
  constructor(message: string = CONTENT_FILTERED_MESSAGE) {
    super(message);
    this.name = "ContentFilteredError";
  }
}
