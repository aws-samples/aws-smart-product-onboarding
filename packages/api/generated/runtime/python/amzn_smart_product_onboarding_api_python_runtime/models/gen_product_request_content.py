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
from amzn_smart_product_onboarding_api_python_runtime.models.gen_product_request_content_description_length_enum import GenProductRequestContentDescriptionLengthEnum
from amzn_smart_product_onboarding_api_python_runtime.models.gen_product_request_content_model_enum import GenProductRequestContentModelEnum
from amzn_smart_product_onboarding_api_python_runtime.models.product_data import ProductData
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

class GenProductRequestContent(BaseModel):
    """
    GenProductRequestContent
    """ # noqa: E501
    language: Optional[StrictStr] = Field(default=None, description="The language of the product description. You can specify a natural description of the language.")
    description_length: Optional[GenProductRequestContentDescriptionLengthEnum] = Field(default=None, alias="descriptionLength")
    product_images: Annotated[List[StrictStr], Field(strict=True, max_length=20)] = Field(alias="productImages", description="The S3 keys of the images for the product.")
    metadata: Optional[StrictStr] = Field(default=None, description="Metadata for the product from the manufacturer or distributor.")
    temperature: Optional[Union[StrictFloat, StrictInt]] = Field(default=None, description="The level for randomness for the LLM.")
    model: Optional[GenProductRequestContentModelEnum] = None
    examples: Optional[Annotated[List[ProductData], Field(strict=True, max_length=5)]] = Field(default=None, description="Examples of good product descriptions with the desired tone and language.")
    __properties: ClassVar[List[str]] = ["language", "descriptionLength", "productImages", "metadata", "temperature", "model", "examples"]


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
        """Create an instance of GenProductRequestContent from a JSON string"""
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
        # override the default output from pydantic by calling `to_dict()` of description_length
        if self.description_length:
            _dict['descriptionLength'] = self.description_length.to_dict()
        # override the default output from pydantic by calling `to_dict()` of model
        if self.model:
            _dict['model'] = self.model.to_dict()
        # override the default output from pydantic by calling `to_dict()` of each item in examples (list)
        _items = []
        if self.examples:
            for _item in self.examples:
                if _item:
                    _items.append(_item.to_dict())
            _dict['examples'] = _items
        return _dict

    @classmethod
    def from_dict(cls, obj: Dict) -> Self:
        """Create an instance of GenProductRequestContent from a dict"""

        if obj is None:
            return None

        if not isinstance(obj, dict):
            return cls.model_validate(obj)

        _obj = cls.model_validate({
            "language": obj.get("language"),
            "descriptionLength": GenProductRequestContentDescriptionLengthEnum.from_dict(obj.get("descriptionLength")) if obj.get("descriptionLength") is not None else None,
            "productImages": List[str].from_dict(obj.get("productImages")) if obj.get("productImages") is not None else None,
            "metadata": obj.get("metadata"),
            "temperature": obj.get("temperature"),
            "model": GenProductRequestContentModelEnum.from_dict(obj.get("model")) if obj.get("model") is not None else None,
            "examples": [ProductData.from_dict(_item) for _item in obj.get("examples")] if obj.get("examples") is not None else None
        })
        return _obj

