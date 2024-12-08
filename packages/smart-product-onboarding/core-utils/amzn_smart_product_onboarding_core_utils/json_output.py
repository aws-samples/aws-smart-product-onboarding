# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from json import loads, JSONDecodeError

from amzn_smart_product_onboarding_core_utils.logger import logger


def find_json(haystack):
    """Find the index of the first '{' and last '}' in the string. test to see if the slice is valid json and return the object."""
    if isinstance(haystack, bytes):
        haystack = haystack.decode()
    logger.debug(f"Finding JSON in {haystack}")
    start_index = haystack.find("{")
    end_index = haystack.rfind("}") + 1
    if start_index == -1 or end_index == 0:
        logger.debug(
            f"Response is missing brackets. Let's try adding some. start_index: {start_index}, end_index: {end_index}"
        )
        if start_index == -1:
            haystack = "{" + haystack
        if end_index == 0:
            haystack = haystack + "}"
        try:
            return loads(haystack)
        except JSONDecodeError:
            logger.error(f"Failed to parse JSON: {haystack}")
            return None
    if haystack[start_index:end_index]:
        try:
            return loads(haystack[start_index:end_index])
        except JSONDecodeError:
            logger.error(f"Failed to parse JSON: {haystack[start_index : end_index]}")
            return None
    return None
