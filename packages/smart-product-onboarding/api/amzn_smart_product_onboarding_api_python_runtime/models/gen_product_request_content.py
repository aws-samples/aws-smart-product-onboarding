# coding: utf-8

"""
    Smart Product Onboarding API

    No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)

    The version of the OpenAPI document: 1.0.0
    Generated by OpenAPI Generator (https://openapi-generator.tech)

    Do not edit the class manually.
"""  # noqa: E501


from __future__ import annotations
import pprint
import re  # noqa: F401
import json


from typing import Any, ClassVar, Dict, List, Optional, Union
from pydantic import BaseModel, StrictFloat, StrictInt, StrictStr, field_validator
from pydantic import Field
from typing_extensions import Annotated
from amzn_smart_product_onboarding_api_python_runtime.models.product_data import ProductData
try:
    from typing import Self
except ImportError:
    from typing_extensions import Self

class GenProductRequestContent(BaseModel):
    """
    GenProductRequestContent
    """ # noqa: E501
    language: Optional[StrictStr] = Field(default='English', description="The language of the product description. You can specify a natural description of the language.")
    description_length: Optional[StrictStr] = Field(default='medium', description="The desired length of the product description.", alias="descriptionLength")
    product_images: Annotated[List[StrictStr], Field(max_length=20)] = Field(description="The S3 keys of the images for the product.", alias="productImages")
    metadata: Optional[StrictStr] = Field(default=None, description="Metadata for the product from the manufacturer or distributor.")
    temperature: Optional[Union[StrictFloat, StrictInt]] = Field(default=0.7, description="The level for randomness for the LLM.")
    model: Optional[StrictStr] = Field(default='us.anthropic.claude-3-haiku-20240307-v1:0', description="The model to use for the LLM. Currently, only Anthropic Claude 3 and Amazon Nova variants are supported.")
    examples: Optional[Annotated[List[ProductData], Field(max_length=5)]] = Field(default=None, description="Examples of good product descriptions with the desired tone and language.")
    __properties: ClassVar[List[str]] = ["language", "descriptionLength", "productImages", "metadata", "temperature", "model", "examples"]

    @field_validator('description_length')
    def description_length_validate_enum(cls, value):
        """Validates the enum"""
        if value is None:
            return value

        if value not in ('short', 'medium', 'long'):
            raise ValueError("must be one of enum values ('short', 'medium', 'long')")
        return value

    @field_validator('model')
    def model_validate_enum(cls, value):
        """Validates the enum"""
        if value is None:
            return value

        if value not in ('us.anthropic.claude-3-haiku-20240307-v1:0', 'us.anthropic.claude-3-5-sonnet-20240620-v1:0', 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.anthropic.claude-3-sonnet-20240229-v1:0', 'us.amazon.nova-pro-v1:0', 'us.amazon.nova-lite-v1:0'):
            raise ValueError("must be one of enum values ('us.anthropic.claude-3-haiku-20240307-v1:0', 'us.anthropic.claude-3-5-sonnet-20240620-v1:0', 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', 'us.anthropic.claude-3-sonnet-20240229-v1:0', 'us.amazon.nova-pro-v1:0', 'us.amazon.nova-lite-v1:0')")
        return value

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
            "language": obj.get("language") if obj.get("language") is not None else 'English',
            "descriptionLength": obj.get("descriptionLength") if obj.get("descriptionLength") is not None else 'medium',
            "productImages": obj.get("productImages"),
            "metadata": obj.get("metadata"),
            "temperature": obj.get("temperature") if obj.get("temperature") is not None else 0.7,
            "model": obj.get("model") if obj.get("model") is not None else 'us.anthropic.claude-3-haiku-20240307-v1:0',
            "examples": [ProductData.from_dict(_item) for _item in obj.get("examples")] if obj.get("examples") is not None else None
        })
        return _obj

