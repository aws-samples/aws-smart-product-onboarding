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
    The model to use for the LLM. Currently, only Anthropic Claude 3 and Amazon Nova variants are supported.
    """

    """
    allowed enum values
    """
    US_ANTHROPIC_CLAUDE_3_HAIKU_20240307_V1_0 = 'us.anthropic.claude-3-haiku-20240307-v1:0'
    US_ANTHROPIC_CLAUDE_3_5_SONNET_20240620_V1_0 = 'us.anthropic.claude-3-5-sonnet-20240620-v1:0'
    US_ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0 = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0'
    US_ANTHROPIC_CLAUDE_3_SONNET_20240229_V1_0 = 'us.anthropic.claude-3-sonnet-20240229-v1:0'
    US_AMAZON_NOVA_PRO_V1_0 = 'us.amazon.nova-pro-v1:0'
    US_AMAZON_NOVA_LITE_V1_0 = 'us.amazon.nova-lite-v1:0'

    @classmethod
    def from_json(cls, json_str: str) -> Self:
        """Create an instance of GenProductRequestContentModelEnum from a JSON string"""
        return cls(json.loads(json_str))



