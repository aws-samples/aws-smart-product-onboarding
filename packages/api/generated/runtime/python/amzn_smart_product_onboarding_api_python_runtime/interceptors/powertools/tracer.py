from aws_lambda_powertools import Tracer
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import ApiResponse, ChainedApiRequest

tracer = Tracer()
is_cold_start = True

class TracingInterceptor:
    def __init__(self, add_response_as_metadata: bool = False):
        self._add_response_as_metadata = add_response_as_metadata

    def intercept(self, request: ChainedApiRequest) -> ApiResponse:
        """
        An interceptor for adding an aws powertools tracer to the interceptor context
        See: https://docs.powertools.aws.dev/lambda/python/latest/core/tracer/
        """
        request.interceptor_context["tracer"] = tracer

        operation_id = request.interceptor_context["operationId"]

        with tracer.provider.in_subsegment(name=f"## {operation_id}") as subsegment:
            try:
                result = request.chain.next(request)
                tracer._add_response_as_metadata(
                    method_name=operation_id,
                    data=result,
                    subsegment=subsegment,
                    capture_response=self._add_response_as_metadata
                )
                return result
            except Exception as e:
                tracer._add_full_exception_as_metadata(
                    method_name=operation_id,
                    error=e,
                    subsegment=subsegment,
                    capture_error=True
                )
                raise
            finally:
                global is_cold_start
                subsegment.put_annotation(key="ColdStart", value=is_cold_start)
                is_cold_start = False

    @staticmethod
    def get_tracer(request: ChainedApiRequest) -> Tracer:
        """
        Retrieve the metrics logger from the request
        """
        if request.interceptor_context.get("tracer") is None:
            raise Exception("No tracer found. Did you configure the TracingInterceptor?")
        return request.interceptor_context["tracer"]
