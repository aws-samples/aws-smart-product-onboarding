from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import ApiResponse, ChainedApiRequest
from amzn_smart_product_onboarding_api_python_runtime.response import Response


def try_catch_interceptor(request: ChainedApiRequest) -> ApiResponse:
    """
    Interceptor for catching unhandled exceptions and returning a 500 error.
    Uncaught exceptions which are ApiResponses will be returned, such that deeply nested code may return error
    responses, eg: `throw Response.not_found(...)`
    """
    try:
        return request.chain.next(request)
    except ApiResponse as response:
        # If the error is a response, return it as the response
        return response
    except Exception as e:
        if request.interceptor_context.get("logger") is not None:
            request.interceptor_context.get("logger").exception("Interceptor caught exception")
        else:
            print("Interceptor caught exception")
            print(e)

        return Response.internal_failure({ "message": "Internal Error" })
