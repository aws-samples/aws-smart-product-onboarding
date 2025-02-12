from __future__ import annotations
import urllib.parse
import json
from typing import Callable, Any, Dict, List, NamedTuple, TypeVar, Generic, Union, TypedDict, Protocol, Optional, Literal, Annotated
from functools import wraps
from dataclasses import dataclass, fields
from datetime import datetime
import dateutil.parser
from pydantic import BaseModel, Field, StrictStr, conlist, StrictBool, StrictInt, StrictFloat

from amzn_smart_product_onboarding_api_python_runtime.models import *

T = TypeVar('T')

# Generic type for object keyed by operation names
@dataclass
class OperationConfig(Generic[T]):
    categorize_product: T
    create_batch_execution: T
    download_file: T
    extract_attributes: T
    generate_product: T
    get_batch_execution: T
    list_batch_executions: T
    metaclass: T
    upload_file: T
    ...

# Look up path and http method for a given operation name
OperationLookup = {
    "categorize_product": {
        "path": "/categorizeProduct",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "create_batch_execution": {
        "path": "/createBatchExecution",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "download_file": {
        "path": "/downloadFile",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "extract_attributes": {
        "path": "/extractAttributes",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "generate_product": {
        "path": "/generateProduct",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "get_batch_execution": {
        "path": "/getBatchExecution/{executionId}",
        "method": "GET",
        "contentTypes": ["application/json"]
    },
    "list_batch_executions": {
        "path": "/listBatchExecutions",
        "method": "GET",
        "contentTypes": ["application/json"]
    },
    "metaclass": {
        "path": "/metaclass",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
    "upload_file": {
        "path": "/uploadFile",
        "method": "POST",
        "contentTypes": ["application/json"]
    },
}

class Operations:
    @staticmethod
    def all(value: T) -> OperationConfig[T]:
        """
        Returns an OperationConfig with the same value for every operation
        """
        return OperationConfig(**{ operation_id: value for operation_id, _ in OperationLookup.items() })

def uri_decode(value):
    """
    URI decode a value or list of values
    """
    if isinstance(value, list):
        return [urllib.parse.unquote(v) for v in value]
    return urllib.parse.unquote(value)

def decode_request_parameters(parameters):
    """
    URI decode api request parameters (path, query or multi-value query)
    """
    return { key: uri_decode(parameters[key]) if parameters[key] is not None else parameters[key] for key in parameters.keys() }

def parse_body(body, content_types, model):
    """
    Parse the body of an api request into the given model if present
    """
    if len([c for c in content_types if c != 'application/json']) == 0:
        if model != Any:
            body = model.model_validate(json.loads(body))
        else:
            body = json.loads(body or '{}')
    return body

def assert_required(required, base_name, parameters):
    if required and parameters.get(base_name) is None:
        raise Exception(f"Missing required request parameter '{base_name}'")

def coerce_float(base_name, s):
    try:
        return float(s)
    except Exception as e:
        raise Exception(f"Expected a number for request parameter '{base_name}'")

def coerce_int(base_name, s):
    try:
        return int(s)
    except Exception as e:
        raise Exception(f"Expected an integer for request parameter '{base_name}'")

def coerce_datetime(base_name, s):
    try:
        return dateutil.parser.parse(s)
    except Exception as e:
        raise Exception(f"Expected a valid date (iso format) for request parameter '{base_name}'")

def coerce_bool(base_name, s):
    if s == "true":
        return True
    elif s == "false":
        return False
    raise Exception(f"Expected a boolean (true or false) for request parameter '{base_name}'")

def coerce_parameter(base_name, data_type, raw_string_parameters, raw_string_array_parameters, required):
    if data_type == "float":
        assert_required(required, base_name, raw_string_parameters)
        param = raw_string_parameters.get(base_name)
        return None if param is None else coerce_float(base_name, param)
    elif data_type == "int":
        assert_required(required, base_name, raw_string_parameters)
        param = raw_string_parameters.get(base_name)
        return None if param is None else coerce_int(base_name, param)
    elif data_type == "bool":
        assert_required(required, base_name, raw_string_parameters)
        param = raw_string_parameters.get(base_name)
        return None if param is None else coerce_bool(base_name, param)
    elif data_type == "datetime":
        assert_required(required, base_name, raw_string_parameters)
        param = raw_string_parameters.get(base_name)
        return None if param is None else coerce_datetime(base_name, param)
    elif data_type == "List[float]":
        assert_required(required, base_name, raw_string_array_parameters)
        param = raw_string_array_parameters.get(base_name)
        return None if param is None else [coerce_float(base_name, p) for p in param]
    elif data_type == "List[int]":
        assert_required(required, base_name, raw_string_array_parameters)
        param = raw_string_array_parameters.get(base_name)
        return None if param is None else [coerce_int(base_name, p) for p in param]
    elif data_type == "List[bool]":
        assert_required(required, base_name, raw_string_array_parameters)
        param = raw_string_array_parameters.get(base_name)
        return None if param is None else [coerce_bool(base_name, p) for p in param]
    elif data_type == "List[datetime]":
        assert_required(required, base_name, raw_string_array_parameters)
        param = raw_string_array_parameters.get(base_name)
        return None if param is None else [coerce_datetime(base_name, p) for p in param]
    elif data_type == "List[str]":
        assert_required(required, base_name, raw_string_array_parameters)
        return raw_string_array_parameters.get(base_name)
    else: # data_type == "str"
        assert_required(required, base_name, raw_string_parameters)
        return raw_string_parameters.get(base_name)


def extract_response_headers_from_interceptors(interceptors):
    headers = {}
    for interceptor in interceptors:
        additional_headers = getattr(interceptor, "__type_safe_api_response_headers", None)
        headers = {**headers, **(additional_headers or {})}
    return headers


RequestParameters = TypeVar('RequestParameters')
RequestBody = TypeVar('RequestBody')
ResponseBody = TypeVar('ResponseBody')
StatusCode = TypeVar('StatusCode')

@dataclass
class ApiRequest(Generic[RequestParameters, RequestBody]):
    request_parameters: RequestParameters
    body: RequestBody
    event: Any
    context: Any
    interceptor_context: Dict[str, Any]

@dataclass
class ChainedApiRequest(ApiRequest[RequestParameters, RequestBody],
    Generic[RequestParameters, RequestBody]):

    chain: 'HandlerChain'

@dataclass
class ApiResponse(Exception, Generic[StatusCode, ResponseBody]):
    status_code: StatusCode
    headers: Dict[str, str]
    body: ResponseBody
    multi_value_headers: Optional[Dict[str, List[str]]] = None

class HandlerChain(Generic[RequestParameters, RequestBody, StatusCode, ResponseBody]):
    def next(self, request: ChainedApiRequest[RequestParameters, RequestBody]) -> ApiResponse[StatusCode, ResponseBody]:
        raise Exception("Not implemented!")

def _build_handler_chain(_interceptors, handler) -> HandlerChain:
    if len(_interceptors) == 0:
        class BaseHandlerChain(HandlerChain[RequestParameters, RequestBody, StatusCode, ResponseBody]):
            def next(self, request: ApiRequest[RequestParameters, RequestBody]) -> ApiResponse[StatusCode, ResponseBody]:
                return handler(request)
        return BaseHandlerChain()
    else:
        interceptor = _interceptors[0]

        class RemainingHandlerChain(HandlerChain[RequestParameters, RequestBody, StatusCode, ResponseBody]):
            def next(self, request: ChainedApiRequest[RequestParameters, RequestBody]) -> ApiResponse[StatusCode, ResponseBody]:
                return interceptor(ChainedApiRequest(
                    request_parameters = request.request_parameters,
                    body = request.body,
                    event = request.event,
                    context = request.context,
                    interceptor_context = request.interceptor_context,
                    chain = _build_handler_chain(_interceptors[1:len(_interceptors)], handler),
                ))
        return RemainingHandlerChain()


class CategorizeProductRequestParameters(BaseModel):
    """
    Query, path and header parameters for the CategorizeProduct operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> CategorizeProductRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> CategorizeProductRequestParameters:
        if obj is None:
            return None
        return CategorizeProductRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
CategorizeProductRequestBody = CategorizeProductRequestContent

CategorizeProduct200OperationResponse = ApiResponse[Literal[200], CategorizeProductResponseContent]
CategorizeProduct400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
CategorizeProduct403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
CategorizeProduct500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

CategorizeProductOperationResponses = Union[CategorizeProduct200OperationResponse, CategorizeProduct400OperationResponse, CategorizeProduct403OperationResponse, CategorizeProduct500OperationResponse, ]

# Request type for categorize_product
CategorizeProductRequest = ApiRequest[CategorizeProductRequestParameters, CategorizeProductRequestBody]
CategorizeProductChainedRequest = ChainedApiRequest[CategorizeProductRequestParameters, CategorizeProductRequestBody]

class CategorizeProductHandlerFunction(Protocol):
    def __call__(self, input: CategorizeProductRequest, **kwargs) -> CategorizeProductOperationResponses:
        ...

CategorizeProductInterceptor = Callable[[CategorizeProductChainedRequest], CategorizeProductOperationResponses]

def categorize_product_handler(_handler: CategorizeProductHandlerFunction = None, interceptors: List[CategorizeProductInterceptor] = []):
    """
    Decorator for an api handler for the categorize_product operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: CategorizeProductHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = CategorizeProductRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], CategorizeProductRequestBody)
            interceptor_context = {
                "operationId": "categorize_product",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by categorize_product_handler.")

class CreateBatchExecutionRequestParameters(BaseModel):
    """
    Query, path and header parameters for the CreateBatchExecution operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> CreateBatchExecutionRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> CreateBatchExecutionRequestParameters:
        if obj is None:
            return None
        return CreateBatchExecutionRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
CreateBatchExecutionRequestBody = CreateBatchExecutionRequestContent

CreateBatchExecution200OperationResponse = ApiResponse[Literal[200], StartBatchExecutionResponseContent]
CreateBatchExecution400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
CreateBatchExecution403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
CreateBatchExecution500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

CreateBatchExecutionOperationResponses = Union[CreateBatchExecution200OperationResponse, CreateBatchExecution400OperationResponse, CreateBatchExecution403OperationResponse, CreateBatchExecution500OperationResponse, ]

# Request type for create_batch_execution
CreateBatchExecutionRequest = ApiRequest[CreateBatchExecutionRequestParameters, CreateBatchExecutionRequestBody]
CreateBatchExecutionChainedRequest = ChainedApiRequest[CreateBatchExecutionRequestParameters, CreateBatchExecutionRequestBody]

class CreateBatchExecutionHandlerFunction(Protocol):
    def __call__(self, input: CreateBatchExecutionRequest, **kwargs) -> CreateBatchExecutionOperationResponses:
        ...

CreateBatchExecutionInterceptor = Callable[[CreateBatchExecutionChainedRequest], CreateBatchExecutionOperationResponses]

def create_batch_execution_handler(_handler: CreateBatchExecutionHandlerFunction = None, interceptors: List[CreateBatchExecutionInterceptor] = []):
    """
    Decorator for an api handler for the create_batch_execution operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: CreateBatchExecutionHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = CreateBatchExecutionRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], CreateBatchExecutionRequestBody)
            interceptor_context = {
                "operationId": "create_batch_execution",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by create_batch_execution_handler.")

class DownloadFileRequestParameters(BaseModel):
    """
    Query, path and header parameters for the DownloadFile operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> DownloadFileRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> DownloadFileRequestParameters:
        if obj is None:
            return None
        return DownloadFileRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
DownloadFileRequestBody = DownloadFileRequestContent

DownloadFile200OperationResponse = ApiResponse[Literal[200], PresignedUrlResponse]
DownloadFile400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
DownloadFile403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
DownloadFile500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

DownloadFileOperationResponses = Union[DownloadFile200OperationResponse, DownloadFile400OperationResponse, DownloadFile403OperationResponse, DownloadFile500OperationResponse, ]

# Request type for download_file
DownloadFileRequest = ApiRequest[DownloadFileRequestParameters, DownloadFileRequestBody]
DownloadFileChainedRequest = ChainedApiRequest[DownloadFileRequestParameters, DownloadFileRequestBody]

class DownloadFileHandlerFunction(Protocol):
    def __call__(self, input: DownloadFileRequest, **kwargs) -> DownloadFileOperationResponses:
        ...

DownloadFileInterceptor = Callable[[DownloadFileChainedRequest], DownloadFileOperationResponses]

def download_file_handler(_handler: DownloadFileHandlerFunction = None, interceptors: List[DownloadFileInterceptor] = []):
    """
    Decorator for an api handler for the download_file operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: DownloadFileHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = DownloadFileRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], DownloadFileRequestBody)
            interceptor_context = {
                "operationId": "download_file",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by download_file_handler.")

class ExtractAttributesRequestParameters(BaseModel):
    """
    Query, path and header parameters for the ExtractAttributes operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> ExtractAttributesRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> ExtractAttributesRequestParameters:
        if obj is None:
            return None
        return ExtractAttributesRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
ExtractAttributesRequestBody = ExtractAttributesRequestContent

ExtractAttributes200OperationResponse = ApiResponse[Literal[200], ExtractAttributesResponseContent]
ExtractAttributes400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
ExtractAttributes403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
ExtractAttributes500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

ExtractAttributesOperationResponses = Union[ExtractAttributes200OperationResponse, ExtractAttributes400OperationResponse, ExtractAttributes403OperationResponse, ExtractAttributes500OperationResponse, ]

# Request type for extract_attributes
ExtractAttributesRequest = ApiRequest[ExtractAttributesRequestParameters, ExtractAttributesRequestBody]
ExtractAttributesChainedRequest = ChainedApiRequest[ExtractAttributesRequestParameters, ExtractAttributesRequestBody]

class ExtractAttributesHandlerFunction(Protocol):
    def __call__(self, input: ExtractAttributesRequest, **kwargs) -> ExtractAttributesOperationResponses:
        ...

ExtractAttributesInterceptor = Callable[[ExtractAttributesChainedRequest], ExtractAttributesOperationResponses]

def extract_attributes_handler(_handler: ExtractAttributesHandlerFunction = None, interceptors: List[ExtractAttributesInterceptor] = []):
    """
    Decorator for an api handler for the extract_attributes operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: ExtractAttributesHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = ExtractAttributesRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], ExtractAttributesRequestBody)
            interceptor_context = {
                "operationId": "extract_attributes",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by extract_attributes_handler.")

class GenerateProductRequestParameters(BaseModel):
    """
    Query, path and header parameters for the GenerateProduct operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> GenerateProductRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> GenerateProductRequestParameters:
        if obj is None:
            return None
        return GenerateProductRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
GenerateProductRequestBody = GenProductRequestContent

GenerateProduct200OperationResponse = ApiResponse[Literal[200], GenProductResponseContent]
GenerateProduct400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
GenerateProduct403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
GenerateProduct500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

GenerateProductOperationResponses = Union[GenerateProduct200OperationResponse, GenerateProduct400OperationResponse, GenerateProduct403OperationResponse, GenerateProduct500OperationResponse, ]

# Request type for generate_product
GenerateProductRequest = ApiRequest[GenerateProductRequestParameters, GenerateProductRequestBody]
GenerateProductChainedRequest = ChainedApiRequest[GenerateProductRequestParameters, GenerateProductRequestBody]

class GenerateProductHandlerFunction(Protocol):
    def __call__(self, input: GenerateProductRequest, **kwargs) -> GenerateProductOperationResponses:
        ...

GenerateProductInterceptor = Callable[[GenerateProductChainedRequest], GenerateProductOperationResponses]

def generate_product_handler(_handler: GenerateProductHandlerFunction = None, interceptors: List[GenerateProductInterceptor] = []):
    """
    Decorator for an api handler for the generate_product operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: GenerateProductHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = GenerateProductRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], GenerateProductRequestBody)
            interceptor_context = {
                "operationId": "generate_product",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by generate_product_handler.")

class GetBatchExecutionRequestParameters(BaseModel):
    """
    Query, path and header parameters for the GetBatchExecution operation
    """
    execution_id: StrictStr

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> GetBatchExecutionRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> GetBatchExecutionRequestParameters:
        if obj is None:
            return None
        return GetBatchExecutionRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
GetBatchExecutionRequestBody = Any

GetBatchExecution200OperationResponse = ApiResponse[Literal[200], BatchExecution]
GetBatchExecution400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
GetBatchExecution403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
GetBatchExecution500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

GetBatchExecutionOperationResponses = Union[GetBatchExecution200OperationResponse, GetBatchExecution400OperationResponse, GetBatchExecution403OperationResponse, GetBatchExecution500OperationResponse, ]

# Request type for get_batch_execution
GetBatchExecutionRequest = ApiRequest[GetBatchExecutionRequestParameters, GetBatchExecutionRequestBody]
GetBatchExecutionChainedRequest = ChainedApiRequest[GetBatchExecutionRequestParameters, GetBatchExecutionRequestBody]

class GetBatchExecutionHandlerFunction(Protocol):
    def __call__(self, input: GetBatchExecutionRequest, **kwargs) -> GetBatchExecutionOperationResponses:
        ...

GetBatchExecutionInterceptor = Callable[[GetBatchExecutionChainedRequest], GetBatchExecutionOperationResponses]

def get_batch_execution_handler(_handler: GetBatchExecutionHandlerFunction = None, interceptors: List[GetBatchExecutionInterceptor] = []):
    """
    Decorator for an api handler for the get_batch_execution operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: GetBatchExecutionHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = GetBatchExecutionRequestParameters.from_dict({
                    "execution_id": coerce_parameter("executionId", "str", raw_string_parameters, raw_string_array_parameters, True),
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            body = {}
            interceptor_context = {
                "operationId": "get_batch_execution",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by get_batch_execution_handler.")

class ListBatchExecutionsRequestParameters(BaseModel):
    """
    Query, path and header parameters for the ListBatchExecutions operation
    """
    start_time: Optional[StrictStr]
    end_time: Optional[StrictStr]

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> ListBatchExecutionsRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> ListBatchExecutionsRequestParameters:
        if obj is None:
            return None
        return ListBatchExecutionsRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
ListBatchExecutionsRequestBody = Any

ListBatchExecutions200OperationResponse = ApiResponse[Literal[200], ListBatchExecutionsResponseContent]
ListBatchExecutions400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
ListBatchExecutions403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
ListBatchExecutions500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

ListBatchExecutionsOperationResponses = Union[ListBatchExecutions200OperationResponse, ListBatchExecutions400OperationResponse, ListBatchExecutions403OperationResponse, ListBatchExecutions500OperationResponse, ]

# Request type for list_batch_executions
ListBatchExecutionsRequest = ApiRequest[ListBatchExecutionsRequestParameters, ListBatchExecutionsRequestBody]
ListBatchExecutionsChainedRequest = ChainedApiRequest[ListBatchExecutionsRequestParameters, ListBatchExecutionsRequestBody]

class ListBatchExecutionsHandlerFunction(Protocol):
    def __call__(self, input: ListBatchExecutionsRequest, **kwargs) -> ListBatchExecutionsOperationResponses:
        ...

ListBatchExecutionsInterceptor = Callable[[ListBatchExecutionsChainedRequest], ListBatchExecutionsOperationResponses]

def list_batch_executions_handler(_handler: ListBatchExecutionsHandlerFunction = None, interceptors: List[ListBatchExecutionsInterceptor] = []):
    """
    Decorator for an api handler for the list_batch_executions operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: ListBatchExecutionsHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = ListBatchExecutionsRequestParameters.from_dict({
                    "start_time": coerce_parameter("start_time", "str", raw_string_parameters, raw_string_array_parameters, False),
                    "end_time": coerce_parameter("end_time", "str", raw_string_parameters, raw_string_array_parameters, False),
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            body = {}
            interceptor_context = {
                "operationId": "list_batch_executions",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by list_batch_executions_handler.")

class MetaclassRequestParameters(BaseModel):
    """
    Query, path and header parameters for the Metaclass operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> MetaclassRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> MetaclassRequestParameters:
        if obj is None:
            return None
        return MetaclassRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
MetaclassRequestBody = MetaclassRequestContent

Metaclass200OperationResponse = ApiResponse[Literal[200], MetaclassResponseContent]
Metaclass400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
Metaclass403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
Metaclass500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

MetaclassOperationResponses = Union[Metaclass200OperationResponse, Metaclass400OperationResponse, Metaclass403OperationResponse, Metaclass500OperationResponse, ]

# Request type for metaclass
MetaclassRequest = ApiRequest[MetaclassRequestParameters, MetaclassRequestBody]
MetaclassChainedRequest = ChainedApiRequest[MetaclassRequestParameters, MetaclassRequestBody]

class MetaclassHandlerFunction(Protocol):
    def __call__(self, input: MetaclassRequest, **kwargs) -> MetaclassOperationResponses:
        ...

MetaclassInterceptor = Callable[[MetaclassChainedRequest], MetaclassOperationResponses]

def metaclass_handler(_handler: MetaclassHandlerFunction = None, interceptors: List[MetaclassInterceptor] = []):
    """
    Decorator for an api handler for the metaclass operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: MetaclassHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = MetaclassRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], MetaclassRequestBody)
            interceptor_context = {
                "operationId": "metaclass",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by metaclass_handler.")

class UploadFileRequestParameters(BaseModel):
    """
    Query, path and header parameters for the UploadFile operation
    """

    class Config:
        """Pydantic configuration"""
        populate_by_name = True
        validate_assignment = True

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_json(cls, json_str: str) -> UploadFileRequestParameters:
        return cls.from_dict(json.loads(json_str))

    def to_dict(self):
        return self.model_dump(exclude={}, exclude_none=True)

    @classmethod
    def from_dict(cls, obj: dict) -> UploadFileRequestParameters:
        if obj is None:
            return None
        return UploadFileRequestParameters.model_validate(obj)


# Request body type (default to Any when no body parameters exist, or leave unchanged as str if it's a primitive type)
UploadFileRequestBody = UploadFileRequestContent

UploadFile200OperationResponse = ApiResponse[Literal[200], PresignedUrlResponse]
UploadFile400OperationResponse = ApiResponse[Literal[400], BadRequestErrorResponseContent]
UploadFile403OperationResponse = ApiResponse[Literal[403], NotAuthorizedErrorResponseContent]
UploadFile500OperationResponse = ApiResponse[Literal[500], InternalFailureErrorResponseContent]

UploadFileOperationResponses = Union[UploadFile200OperationResponse, UploadFile400OperationResponse, UploadFile403OperationResponse, UploadFile500OperationResponse, ]

# Request type for upload_file
UploadFileRequest = ApiRequest[UploadFileRequestParameters, UploadFileRequestBody]
UploadFileChainedRequest = ChainedApiRequest[UploadFileRequestParameters, UploadFileRequestBody]

class UploadFileHandlerFunction(Protocol):
    def __call__(self, input: UploadFileRequest, **kwargs) -> UploadFileOperationResponses:
        ...

UploadFileInterceptor = Callable[[UploadFileChainedRequest], UploadFileOperationResponses]

def upload_file_handler(_handler: UploadFileHandlerFunction = None, interceptors: List[UploadFileInterceptor] = []):
    """
    Decorator for an api handler for the upload_file operation, providing a typed interface for inputs and outputs
    """
    def _handler_wrapper(handler: UploadFileHandlerFunction):
        @wraps(handler)
        def wrapper(event, context, additional_interceptors = [], **kwargs):
            all_interceptors = additional_interceptors + interceptors

            raw_string_parameters = decode_request_parameters({
                **(event.get('pathParameters', {}) or {}),
                **(event.get('queryStringParameters', {}) or {}),
                **(event.get('headers', {}) or {}),
            })
            raw_string_array_parameters = decode_request_parameters({
                **(event.get('multiValueQueryStringParameters', {}) or {}),
                **(event.get('multiValueHeaders', {}) or {}),
            })

            def response_headers_for_status_code(status_code):
                headers_for_status = {}
                if status_code == 400 and "BadRequestErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "BadRequestErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 403 and "NotAuthorizedErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "NotAuthorizedErrorResponseContent"[:-len("ResponseContent")]
                if status_code == 500 and "InternalFailureErrorResponseContent".endswith("ResponseContent"):
                    headers_for_status["x-amzn-errortype"] = "InternalFailureErrorResponseContent"[:-len("ResponseContent")]
                return headers_for_status

            request_parameters = None
            try:
                request_parameters = UploadFileRequestParameters.from_dict({
                })
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {**response_headers_for_status_code(400), **extract_response_headers_from_interceptors(all_interceptors)},
                    'body': '{"message": "' + str(e) + '"}',
                }

            # Non-primitive type so parse the body into the appropriate model
            body = parse_body(event['body'], ['application/json'], UploadFileRequestBody)
            interceptor_context = {
                "operationId": "upload_file",
            }

            chain = _build_handler_chain(all_interceptors, handler)
            response = chain.next(ApiRequest(
                request_parameters,
                body,
                event,
                context,
                interceptor_context,
            ), **kwargs)

            response_headers = {** (response.headers or {}), **response_headers_for_status_code(response.status_code)}
            response_body = ''
            if response.body is None:
                pass
            elif response.status_code == 200:
                response_body = response.body.to_json()
            elif response.status_code == 400:
                response_body = response.body.to_json()
            elif response.status_code == 403:
                response_body = response.body.to_json()
            elif response.status_code == 500:
                response_body = response.body.to_json()

            return {
                'statusCode': response.status_code,
                'headers': response_headers,
                'multiValueHeaders': response.multi_value_headers or {},
                'body': response_body,
            }
        return wrapper

    # Support use as a decorator with no arguments, or with interceptor arguments
    if callable(_handler):
        return _handler_wrapper(_handler)
    elif _handler is None:
        return _handler_wrapper
    else:
        raise Exception("Positional arguments are not supported by upload_file_handler.")

Interceptor = Callable[[ChainedApiRequest[RequestParameters, RequestBody]], ApiResponse[StatusCode, ResponseBody]]

def concat_method_and_path(method: str, path: str):
    return "{}||{}".format(method.lower(), path)

OperationIdByMethodAndPath = { concat_method_and_path(method_and_path["method"], method_and_path["path"]): operation for operation, method_and_path in OperationLookup.items() }

@dataclass
class HandlerRouterHandlers:
  categorize_product: Callable[[Dict, Any], Dict]
  create_batch_execution: Callable[[Dict, Any], Dict]
  download_file: Callable[[Dict, Any], Dict]
  extract_attributes: Callable[[Dict, Any], Dict]
  generate_product: Callable[[Dict, Any], Dict]
  get_batch_execution: Callable[[Dict, Any], Dict]
  list_batch_executions: Callable[[Dict, Any], Dict]
  metaclass: Callable[[Dict, Any], Dict]
  upload_file: Callable[[Dict, Any], Dict]

def handler_router(handlers: HandlerRouterHandlers, interceptors: List[Interceptor] = []):
    """
    Returns a lambda handler which can be used to route requests to the appropriate typed lambda handler function.
    """
    _handlers = { field.name: getattr(handlers, field.name) for field in fields(handlers) }

    def handler_wrapper(event, context):
        operation_id = OperationIdByMethodAndPath[concat_method_and_path(event['requestContext']['httpMethod'], event['requestContext']['resourcePath'])]
        handler = _handlers[operation_id]
        return handler(event, context, additional_interceptors=interceptors)
    return handler_wrapper
