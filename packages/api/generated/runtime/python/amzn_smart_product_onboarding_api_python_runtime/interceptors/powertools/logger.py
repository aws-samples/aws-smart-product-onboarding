from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging.logger import _is_cold_start
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import ApiResponse, ChainedApiRequest

logger = Logger()

class LoggingInterceptor:

    def intercept(self, request: ChainedApiRequest) -> ApiResponse:
        """
        An interceptor for adding an aws powertools logger to the interceptor context
        See: https://docs.powertools.aws.dev/lambda/python/latest/core/logger/
        """
        request.interceptor_context["logger"] = logger

        # Add the operation id, lambda context and cold start
        logger.append_keys(
            operationId=request.interceptor_context["operationId"],
            **request.context.__dict__,
            cold_start=_is_cold_start()
        )
        response = request.chain.next(request)
        logger.remove_keys(["operationId"])

        return response

    @staticmethod
    def get_logger(request: ChainedApiRequest) -> Logger:
        if request.interceptor_context.get("logger") is None:
            raise Exception("No logger found. Did you configure the LoggingInterceptor?")
        return request.interceptor_context["logger"]
