# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from typing import Optional, TypedDict, Type

from pydantic import BaseModel, Field


def create_typed_dict_from_model[T: BaseModel](model: type[T]) -> type[TypedDict]:
    fields = {name: field.annotation for name, field in model.model_fields.items()}
    return TypedDict(f"{model.__name__}Dict", fields)


# Models
class Product(BaseModel):
    title: str = Field(..., description="Product title")
    short_description: Optional[str] = Field(description="Product short description", default=None)
    description: str = Field(..., description="Product category")
    metadata: Optional[str] = Field(description="Unstructured textual information about the product", default=None)
    images: Optional[list[str]] = Field(description="List of image URLs for the product", default=None)


class BaseProductCategory(BaseModel):
    id: str = Field(..., description="Product category ID")
    name: str = Field(..., description="Product category name")


class ProductCategory(BaseProductCategory):
    description: Optional[str] = Field(
        description="Description of what kinds of products belong in the category",
        default=None,
    )
    full_path: list[BaseProductCategory] = Field(..., description="Path from root")
    childs: list[BaseProductCategory] = Field(..., description="Child categories")
    examples: Optional[list[Product]] = Field(
        description="Examples of products to use for few shot prompting", default=None
    )

    @property
    def formatted_path(self):
        return " > ".join((level.name for level in self.full_path))


class WordFinding(BaseModel):
    position: int = Field(..., description="Position of the word in the title")
    type: str = Field(
        ...,
        description="Type of finding (e.g., full_title, exact_match, word_emb, word_emb_ind, other)",
    )
    word: str = Field(..., description="Category word found")
    score: float = Field(..., description="Likelihood of a match")


class CategorySchema(BaseModel):
    category_name: str
    subcategory_name: str
    attributes_schema: Optional[list[dict]] = None


class Attribute(BaseModel):
    name: str
    value: str | dict[str, "Attribute"] | list[str]  # think better about this type


class Attributes(BaseModel):
    attributes: list[Attribute]


# Schemas
class ProductReadyForMetaclass(BaseModel):
    """Input schema for the metaclass Step Functions task"""

    product: Product = Field(..., description="Product to classify")
    demo: Optional[bool] = Field(description="Demo mode", default=False)


class MetaclassPrediction(BaseModel):
    """Output schema from the metaclass Step Functions task"""

    possible_categories: list[str] = Field(..., description="Possible categories based on metaclass")
    clean_title: Optional[str] = Field(default=None, description="Product title after preprocessing")
    findings: Optional[list[WordFinding]] = Field(default=[], description="Other metaclass predictions")


class ProductReadyForCategorization(BaseModel):
    """Input schema for the categorization Step Functions task"""

    product: Product = Field(..., description="Product to categorize")
    metaclass: MetaclassPrediction = Field(..., description="Metaclass prediction")
    demo: Optional[bool] = Field(description="Demo mode", default=False)
    dryrun: Optional[bool] = Field(default=False, description="Dryrun mode")


class CategorizationPrediction(BaseModel):
    """Output schema for the categorization Step Functions task"""

    predicted_category_id: str = Field(..., description="Predicted category ID")
    predicted_category_name: str = Field(..., description="Predicted category name")
    explanation: str = Field(..., description="Explanation for category selection")
    prompt: Optional[str] = Field(description="Prompt used for categorization", default=None)


class ExtractAttributesRequest(BaseModel):
    product: Product
    category: CategorizationPrediction


class ExtractAttributesResponse(BaseModel):
    attributes: list[Attribute]


ExtractAttributesResponseDict = create_typed_dict_from_model(ExtractAttributesResponse)


class ExtractImagesRequest(BaseModel):
    prefix: str = Field(..., description="prefix to prepend to uploaded s3 keys. A trailing '/' will be added.")
    images_key: str = Field(..., description="s3 key for images zip file")


class ExtractImagesResponse(BaseModel):
    images_prefix: str = Field(..., description="s3 prefix for images extracted from zip file")


ExtractImagesResponseDict = create_typed_dict_from_model(ExtractImagesResponse)
