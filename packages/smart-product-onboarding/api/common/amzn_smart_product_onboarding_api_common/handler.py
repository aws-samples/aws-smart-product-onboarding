# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

"""Lambda handler wrapper for the API operations.

API Gateway validates every request against the OpenAPI definition before it reaches a function. The
wrapper parses the body into the operation's model as a backstop: a body that does not parse gets 400,
never the 422 that request validation libraries usually answer with.
"""

import json
import urllib.parse
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, Generic, TypeVar

from aws_lambda_powertools import Logger, Metrics, Tracer
from pydantic import BaseModel, ValidationError

logger = Logger()
tracer = Tracer()
metrics = Metrics()

# Error types declared in the OpenAPI definition, returned in the x-amzn-errortype header.
ERROR_TYPES = {400: "BadRequestError", 403: "NotAuthorizedError", 500: "InternalFailureError"}
CORS_HEADERS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}

Body = TypeVar("Body", bound=BaseModel)

_cold_start = True


@dataclass
class ApiRequest(Generic[Body]):
    body: Body
    path_parameters: dict[str, str]
    query_parameters: dict[str, str]
    event: dict[str, Any]
    context: Any


@dataclass
class ApiResponse:
    status_code: int
    body: BaseModel | dict[str, Any] | None = None
    headers: dict[str, str] = field(default_factory=dict)


class Response:
    """Responses for the status codes the API declares. Error responses take a message."""

    @staticmethod
    def success(body: BaseModel) -> ApiResponse:
        return ApiResponse(200, body)

    @staticmethod
    def bad_request(message: str) -> ApiResponse:
        return ApiResponse(400, {"message": message})

    @staticmethod
    def not_authorized(message: str) -> ApiResponse:
        return ApiResponse(403, {"message": message})

    @staticmethod
    def not_found(message: str) -> ApiResponse:
        return ApiResponse(404, {"message": message})

    @staticmethod
    def internal_failure(message: str) -> ApiResponse:
        return ApiResponse(500, {"message": message})


def _to_proxy_result(response: ApiResponse) -> dict[str, Any]:
    if isinstance(response.body, BaseModel):
        body: Any = response.body.model_dump(mode="json", by_alias=True, exclude_none=True)
    else:
        body = response.body
    error_type = ERROR_TYPES.get(response.status_code)
    return {
        "statusCode": response.status_code,
        "headers": {
            **CORS_HEADERS,
            **response.headers,
            **({"x-amzn-errortype": error_type} if error_type else {}),
        },
        "multiValueHeaders": {},
        "body": json.dumps(body) if body is not None else "",
    }


def _decoded(parameters: dict[str, str] | None) -> dict[str, str]:
    return {key: urllib.parse.unquote(value) for key, value in (parameters or {}).items() if value is not None}


def _parse_body(event: dict[str, Any], model: type[BaseModel] | None) -> BaseModel | None:
    if model is None:
        return None
    try:
        return model.model_validate(json.loads(event.get("body") or "null"))
    except (ValueError, ValidationError) as e:
        # Log where validation failed, not the values: the body can hold customer data.
        issues = e.errors(include_input=False) if isinstance(e, ValidationError) else "not JSON"
        logger.warning("Request body failed validation", extra={"issues": issues})
        raise


def api_handler(
    operation_id: str, body_model: type[BaseModel] | None = None
) -> Callable[[Callable[[ApiRequest[Any]], ApiResponse]], Callable[[dict[str, Any], Any], dict[str, Any]]]:
    """Wrap an operation function as the API Gateway proxy handler of a Lambda function."""

    def decorate(operation: Callable[[ApiRequest[Any]], ApiResponse]):
        @wraps(operation)
        # Never log the raw event, even when POWERTOOLS_LOGGER_LOG_EVENT is set: it carries the
        # Authorization header and the authorizer claims.
        @logger.inject_lambda_context(log_event=False)
        def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
            logger.append_keys(operationId=operation_id)
            metrics.namespace = metrics.namespace or operation_id
            metrics.add_dimension(name="operationId", value=operation_id)
            try:
                with tracer.provider.in_subsegment(name=f"## {operation_id}") as subsegment:
                    global _cold_start
                    subsegment.put_annotation(key="ColdStart", value=_cold_start)
                    _cold_start = False
                    try:
                        body = _parse_body(event, body_model)
                    except (ValueError, ValidationError):
                        return _to_proxy_result(Response.bad_request("Invalid request body"))
                    request = ApiRequest(
                        body=body,
                        path_parameters=_decoded(event.get("pathParameters")),
                        query_parameters=_decoded(event.get("queryStringParameters")),
                        event=event,
                        context=context,
                    )
                    # An error leaves the subsegment so the trace records it as a fault.
                    return _to_proxy_result(operation(request))
            except Exception:
                logger.exception("Unhandled error")
                return _to_proxy_result(Response.internal_failure("Internal Error"))
            finally:
                metrics.flush_metrics()
                logger.remove_keys(["operationId"])

        return handler

    return decorate
