from amzn_smart_product_onboarding_api_python_runtime.interceptors.response_headers import cors_interceptor
from amzn_smart_product_onboarding_api_python_runtime.interceptors.try_catch import try_catch_interceptor
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.logger import LoggingInterceptor
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.tracer import TracingInterceptor
from amzn_smart_product_onboarding_api_python_runtime.interceptors.powertools.metrics import MetricsInterceptor

# All default interceptors, for logging, tracing, metrics, cors headers and error handling
INTERCEPTORS = [
    cors_interceptor,
    LoggingInterceptor().intercept,
    try_catch_interceptor,
    TracingInterceptor().intercept,
    MetricsInterceptor().intercept,
]
