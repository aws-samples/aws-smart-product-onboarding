# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""The generated models must match the schemas in the OpenAPI definition."""

from enum import Enum
from pathlib import Path

import pytest
import yaml
from amzn_smart_product_onboarding_api_common import models
from pydantic import BaseModel, ValidationError

SPEC = yaml.safe_load(
    (Path(__file__).parents[4] / "api" / "model" / "src" / "main" / "openapi" / "main.yaml").read_text()
)
SCHEMAS = SPEC["components"]["schemas"]
OBJECT_SCHEMAS = {name: schema for name, schema in SCHEMAS.items() if schema.get("type") == "object"}
ENUM_SCHEMAS = {name: schema for name, schema in SCHEMAS.items() if "enum" in schema}


def sample(schema):
    """A minimal valid value for a schema."""
    if "$ref" in schema:
        return sample(SCHEMAS[schema["$ref"].split("/")[-1]])
    if "enum" in schema:
        return schema["enum"][0]
    kind = schema.get("type")
    if kind == "object":
        return {key: sample(schema["properties"][key]) for key in schema.get("required", [])}
    if kind == "array":
        return [sample(schema["items"])]
    return {"string": "text", "integer": 15, "number": 0.5, "boolean": True}[kind]


def test_every_schema_has_a_model():
    for name in SCHEMAS:
        assert hasattr(models, name), name


@pytest.mark.parametrize("name", list(OBJECT_SCHEMAS))
def test_fields_and_aliases_match(name):
    model: type[BaseModel] = getattr(models, name)
    schema = OBJECT_SCHEMAS[name]
    wire_names = {field.alias or field_name for field_name, field in model.model_fields.items()}
    assert wire_names == set(schema.get("properties", {}))
    required = {field.alias or field_name for field_name, field in model.model_fields.items() if field.is_required()}
    assert required == set(schema.get("required", []))


@pytest.mark.parametrize("name", list(OBJECT_SCHEMAS))
def test_minimal_payload_round_trips_with_camel_case_names(name):
    model: type[BaseModel] = getattr(models, name)
    payload = sample(OBJECT_SCHEMAS[name])
    parsed = model.model_validate(payload)
    assert parsed.model_dump(mode="json", by_alias=True, exclude_unset=True) == payload
    # Handlers build models with snake_case names.
    assert model.model_validate(parsed.model_dump()) == parsed


@pytest.mark.parametrize("name", list(OBJECT_SCHEMAS))
def test_missing_required_properties_are_rejected(name):
    model: type[BaseModel] = getattr(models, name)
    schema = OBJECT_SCHEMAS[name]
    for key in schema.get("required", []):
        payload = sample(schema)
        del payload[key]
        with pytest.raises(ValidationError):
            model.model_validate(payload)


@pytest.mark.parametrize("name", list(ENUM_SCHEMAS))
def test_enums_are_str_enums_with_the_same_values(name):
    enum: type[Enum] = getattr(models, name)
    assert issubclass(enum, str)
    assert [member.value for member in enum] == ENUM_SCHEMAS[name]["enum"]


def test_inline_enums_match():
    request = SCHEMAS["GenProductRequestContent"]["properties"]
    assert [m.value for m in models.DescriptionLength] == request["descriptionLength"]["enum"]
    assert [m.value for m in models.Model] == request["model"]["enum"]


def test_array_limits_match():
    for name, schema in OBJECT_SCHEMAS.items():
        model: type[BaseModel] = getattr(models, name)
        for field_name, field in model.model_fields.items():
            prop = schema["properties"][field.alias or field_name]
            limit = prop.get("maxItems", prop.get("maxLength") if prop.get("type") == "array" else None)
            if limit is None:
                continue
            payload = sample(schema)
            payload[field.alias or field_name] = [sample(prop["items"])] * (limit + 1)
            with pytest.raises(ValidationError):
                model.model_validate(payload)


def test_integer_limits_match():
    for name in ("DownloadFileRequestContent", "UploadFileRequestContent"):
        model: type[BaseModel] = getattr(models, name)
        expiration = SCHEMAS[name]["properties"]["expiration"]
        payload = sample(SCHEMAS[name])
        for value, valid in (
            (expiration["minimum"], True),
            (expiration["maximum"], True),
            (expiration["minimum"] - 1, False),
            (expiration["maximum"] + 1, False),
        ):
            if valid:
                model.model_validate({**payload, "expiration": value})
            else:
                with pytest.raises(ValidationError):
                    model.model_validate({**payload, "expiration": value})


def test_batch_status_serializes_as_its_value():
    execution = models.BatchExecution(execution_id="a", created_at="c", updated_at="u", status="SUCCESS")
    assert execution.model_dump(mode="json", by_alias=True)["status"] == "SUCCESS"
