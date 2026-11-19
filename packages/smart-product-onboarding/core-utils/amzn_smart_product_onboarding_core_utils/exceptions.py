# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

class RetryableError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ModelResponseError(RetryableError):
    pass


CONTENT_FILTERED_MESSAGE = "Blocked by the model's content filter. Edit the product details or images and try again."


class ContentFilteredError(Exception):
    """The model stopped because a content filter or guardrail blocked the request or the response.

    Not a RetryableError: the same input is blocked again, so callers report it instead of retrying.
    """

    def __init__(self, message: str = CONTENT_FILTERED_MESSAGE):
        super().__init__(message)


class ModelResponseWarning(UserWarning):
    pass


class MaxTokensExceeded(Exception):
    pass
