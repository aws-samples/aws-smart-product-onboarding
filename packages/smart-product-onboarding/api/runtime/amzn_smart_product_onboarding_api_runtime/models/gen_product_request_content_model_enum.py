# coding: utf-8

"""
    Smart Product Onboarding API

    No description provided

    The version of the OpenAPI document: 1.0.0

    NOTE: This class is auto generated.
    Do not edit the class manually.
"""  # noqa: E501

from __future__ import annotations
import pprint
import re  # noqa: F401
import json
from enum import Enum
from datetime import date, datetime
from typing import Any, List, Union, ClassVar, Dict, Optional, TYPE_CHECKING
from pydantic import Field, StrictStr, ValidationError, field_validator, BaseModel, SecretStr, StrictFloat, StrictInt, StrictBytes, StrictBool
from decimal import Decimal
from typing_extensions import Annotated, Literal
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

class GenProductRequestContentModelEnum(str, Enum):
    """
    The model to use for the LLM. Currently, only Anthropic Claude and Amazon Nova multimodal variants are supported. Global inference profiles are used where available for optimal performance.
    """

    """
    allowed enum values
    """
    US_AMAZON_NOVA_LITE_V1_0 = 'us.amazon.nova-lite-v1:0'
    US_AMAZON_NOVA_PRO_V1_0 = 'us.amazon.nova-pro-v1:0'
    GLOBAL_AMAZON_NOVA_2_LITE_V1_0 = 'global.amazon.nova-2-lite-v1:0'
    GLOBAL_ANTHROPIC_CLAUDE_HAIKU_4_5_20251001_V1_0 = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
    GLOBAL_ANTHROPIC_CLAUDE_HAIKU_5_5 = 'global.anthropic.claude-haiku-5-5'
    GLOBAL_ANTHROPIC_CLAUDE_SONNET_5_5 = 'global.anthropic.claude-sonnet-5-5'

    @classmethod
    def from_json(cls, json_str: str) -> Self:
        """Create an instance of GenProductRequestContentModelEnum from a JSON string"""
        return cls(json.loads(json_str))



