# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
import ast
import json
import logging
import os

log_level = os.getenv("LOG_LEVEL", default="INFO")

logger = logging.getLogger()
logger.setLevel(logging.getLevelName(log_level))


def handler(event, _context):
    logger.info(f"Event: {json.dumps(event)}")
    input = {
        "title": event.get("title", ""),
        "description": event.get("description", ""),
        "short_description": event.get("short_description", ""),
        "metadata": event.get("metadata", ""),
        "images": ast.literal_eval(event.get("images", "[]")),
    }

    if not (input["title"] and input["description"]) and not input["images"]:
        logger.error(f"Invalid input: {json.dumps(input)}")
        raise ValueError("either title and description or images are required")
    return input
