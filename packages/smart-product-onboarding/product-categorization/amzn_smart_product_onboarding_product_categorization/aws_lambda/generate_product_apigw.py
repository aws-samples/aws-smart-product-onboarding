# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import os

from amzn_smart_product_onboarding_api_common.handler import ApiRequest, ApiResponse, Response, api_handler
from amzn_smart_product_onboarding_api_common.models import (
    GenProductRequestContent,
    GenProductResponseContent,
    ModelUsage,
    ProductData,
)
from amzn_smart_product_onboarding_core_utils.appconfig_client import AppConfigClient
from amzn_smart_product_onboarding_core_utils.boto3_helper.bedrock_runtime_client import (
    LAMBDA_BEDROCK_RUNTIME_CLIENT,
)
from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import LAMBDA_S3_CLIENT
from amzn_smart_product_onboarding_core_utils.exceptions import ContentFilteredError, RateLimitError
from amzn_smart_product_onboarding_core_utils.logger import logger
from botocore.exceptions import ClientError

from amzn_smart_product_onboarding_product_categorization.product_generator import BadRequestError, ProductGenerator

logger.name = "generate_product_handler"

DEFAULT_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-5-5")
DEFAULT_TEMPERATURE = 0.1

appconfig_client = AppConfigClient(
    application_id=os.getenv("APPCONFIG_APPLICATION_ID", ""),
    environment_id=os.getenv("APPCONFIG_ENVIRONMENT_ID", ""),
    configuration_profile_id=os.getenv("APPCONFIG_CONFIGURATION_PROFILE_ID", ""),
)


def _sent(body: GenProductRequestContent, name: str):
    """The field's value if the request set it, else None. The generated model fills in defaults from the OpenAPI
    definition, but a field the request leaves out falls back to the deployment's configuration instead."""
    return getattr(body, name) if name in body.model_fields_set else None


def generate_product(event: ApiRequest[GenProductRequestContent]) -> ApiResponse:
    logger.info("Start GenerateProduct Operation")
    body = event.body
    bucket = os.getenv("IMAGE_BUCKET")
    if not bucket:
        logger.error("IMAGE_BUCKET environment variable not set!")
        return Response.internal_failure("Internal server error")

    # The request takes precedence over AppConfig, and AppConfig over the function's defaults.
    config = appconfig_client.get_configuration("productGeneration")
    model = _sent(body, "model")
    model_id = str(model) if model else config.model_id if config else DEFAULT_MODEL_ID
    temperature = _sent(body, "temperature")
    if temperature is None:
        temperature = config.temperature if config else DEFAULT_TEMPERATURE
    if not 0 <= temperature <= 1:
        return Response.bad_request("Temperature must be between 0 and 1")

    description_length = _sent(body, "description_length")
    examples = _sent(body, "examples")
    try:
        product = ProductGenerator(LAMBDA_BEDROCK_RUNTIME_CLIENT, LAMBDA_S3_CLIENT, bucket).generate(
            image_keys=body.product_images,
            model_id=model_id,
            temperature=temperature,
            language=_sent(body, "language"),
            description_length=str(description_length) if description_length else None,
            metadata=body.metadata,
            examples=[{"title": e.title, "description": e.description} for e in examples or []],
        )
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if e.operation_name == "Converse" and code == "ValidationException":
            return Response.bad_request("Bad request")
        if e.operation_name == "Converse" and code == "ResourceNotFoundException":
            return Response.not_found("Not Found")
        # An image that could not be read, or any other AWS error.
        logger.error(f"Failed to generate product data. {e.operation_name}: {code}")
        return Response.internal_failure("Internal server error")
    except RateLimitError:
        return Response.internal_failure("Bedrock rate limit exceeded")
    except BadRequestError as e:
        logger.error(f"Invalid input. {e}")
        return Response.bad_request(str(e))
    except ContentFilteredError as e:
        logger.warning(str(e))
        return Response.bad_request(str(e))
    except Exception as e:
        logger.exception(f"Failed to generate product data. {type(e).__name__}")
        return Response.internal_failure("Internal server error")

    return Response.success(
        GenProductResponseContent(
            product=ProductData(title=product.title, description=product.description),
            usage=ModelUsage(input_tokens=product.usage["inputTokens"], output_tokens=product.usage["outputTokens"]),
        )
    )


handler = api_handler("generateProduct", GenProductRequestContent)(generate_product)
