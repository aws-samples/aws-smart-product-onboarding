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
from amzn_smart_product_onboarding_api_python_runtime.models.product_data import ProductData
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

class MetaclassRequestContent(BaseModel):
    """
    MetaclassRequestContent
    """ # noqa: E501
    product: ProductData
    demo: Optional[StrictBool] = None
    __properties: ClassVar[List[str]] = ["product", "demo"]


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
        """Create an instance of MetaclassRequestContent from a JSON string"""
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
        # override the default output from pydantic by calling `to_dict()` of product
        if self.product:
            _dict['product'] = self.product.to_dict()
        return _dict

    @classmethod
    def from_dict(cls, obj: Dict) -> Self:
        """Create an instance of MetaclassRequestContent from a dict"""

        if obj is None:
            return None

        if not isinstance(obj, dict):
            return cls.model_validate(obj)

        _obj = cls.model_validate({
            "product": ProductData.from_dict(obj.get("product")) if obj.get("product") is not None else None,
            "demo": obj.get("demo")
        })
        return _obj

