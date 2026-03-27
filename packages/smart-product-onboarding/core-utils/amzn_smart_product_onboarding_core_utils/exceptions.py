# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

class RetryableError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ModelResponseError(RetryableError):
    pass


class ModelResponseWarning(UserWarning):
    pass


class MaxTokensExceeded(Exception):
    pass
