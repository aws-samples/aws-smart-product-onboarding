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

class GenProductRequestContentDescriptionLengthEnum(str, Enum):
    """
    The desired length of the product description.
    """

    """
    allowed enum values
    """
    SHORT = 'short'
    MEDIUM = 'medium'
    LONG = 'long'

    @classmethod
    def from_json(cls, json_str: str) -> Self:
        """Create an instance of GenProductRequestContentDescriptionLengthEnum from a JSON string"""
        return cls(json.loads(json_str))



