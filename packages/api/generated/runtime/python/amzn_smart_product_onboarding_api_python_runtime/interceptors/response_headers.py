from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import ApiResponse, ChainedApiRequest
from typing import Dict

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
}

def build_response_headers_interceptor(headers: Dict[str, str]):
    """
    Build an interceptor for adding headers to the response.
    """
    def response_headers_interceptor(request: ChainedApiRequest) -> ApiResponse:
        result = request.chain.next(request)
        result.headers = { **headers, **(result.headers or {}) }
        return result

    # Any error responses returned during request validation will include the headers
    response_headers_interceptor.__type_safe_api_response_headers = headers

    return response_headers_interceptor

# Cors interceptor allows all origins and headers. Use build_response_headers_interceptors to customise
cors_interceptor = build_response_headers_interceptor(CORS_HEADERS)

