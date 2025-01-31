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
from amzn_smart_product_onboarding_api_python_runtime.models.word_finding import WordFinding
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

class MetaclassResponseContent(BaseModel):
    """
    MetaclassResponseContent
    """ # noqa: E501
    possible_categories: Annotated[List[StrictStr], Field(strict=True, max_length=600)] = Field(alias="possibleCategories")
    clean_title: Optional[StrictStr] = Field(default=None, alias="cleanTitle")
    findings: Optional[Annotated[List[WordFinding], Field(strict=True, max_length=600)]] = None
    __properties: ClassVar[List[str]] = ["possibleCategories", "cleanTitle", "findings"]


    model_config = {
        "populate_by_name": True,
        "validate_assignment": True
    }

    def to_str(self) -> str:
        """Returns the string representation of the model using alias"""
        return pprint.pformat(self.model_dump(by_alias=True))

    def to_json(self) -> str:
        """Returns the JSON representation of the model using alias"""
        # TODO: pydantic v2: use .model_dump_json(by_alias=True, exclude_unset=True) instead
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> Self:
        """Create an instance of MetaclassResponseContent from a JSON string"""
        return cls.from_dict(json.loads(json_str))

    def to_dict(self) -> Dict[str, Any]:
        """Return the dictionary representation of the model using alias.

        This has the following differences from calling pydantic's
        `self.model_dump(by_alias=True)`:

        * `None` is only added to the output dict for nullable fields that
          were set at model initialization. Other fields with value `None`
          are ignored.
        """
        _dict = self.model_dump(
            by_alias=True,
            exclude={
            },
            exclude_none=True,
        )
        # override the default output from pydantic by calling `to_dict()` of possible_categories
        if self.possible_categories:
            _dict['possibleCategories'] = self.possible_categories.to_dict()
        # override the default output from pydantic by calling `to_dict()` of each item in findings (list)
        _items = []
        if self.findings:
            for _item in self.findings:
                if _item:
                    _items.append(_item.to_dict())
            _dict['findings'] = _items
        return _dict

    @classmethod
    def from_dict(cls, obj: Dict) -> Self:
        """Create an instance of MetaclassResponseContent from a dict"""

        if obj is None:
            return None

        if not isinstance(obj, dict):
            return cls.model_validate(obj)

        _obj = cls.model_validate({
            "possibleCategories": List[str].from_dict(obj.get("possibleCategories")) if obj.get("possibleCategories") is not None else None,
            "cleanTitle": obj.get("cleanTitle"),
            "findings": [WordFinding.from_dict(_item) for _item in obj.get("findings")] if obj.get("findings") is not None else None
        })
        return _obj

