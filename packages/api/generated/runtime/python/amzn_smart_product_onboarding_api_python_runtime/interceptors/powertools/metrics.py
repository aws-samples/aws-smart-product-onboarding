from aws_lambda_powertools import Metrics
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import ApiResponse, ChainedApiRequest

metrics = Metrics()

class MetricsInterceptor:

    def intercept(self, request: ChainedApiRequest) -> ApiResponse:
        """
        An interceptor for adding an aws powertools metrics instance to the interceptor context
        See: https://docs.powertools.aws.dev/lambda/python/latest/core/metrics/
        """
        operation_id = request.interceptor_context["operationId"]

        # Set the namespace if not set via environment variables
        if metrics.namespace is None:
            metrics.namespace = operation_id

        request.interceptor_context["metrics"] = metrics

        try:
            metrics.add_dimension(name="operationId", value=operation_id)
            return request.chain.next(request)
        finally:
            metrics.flush_metrics()

    @staticmethod
    def get_metrics(request: ChainedApiRequest) -> Metrics:
        """
        Retrieve the metrics logger from the request
        """
        if request.interceptor_context.get("metrics") is None:
            raise Exception("No metrics found. Did you configure the MetricsInterceptor?")
        return request.interceptor_context["metrics"]
