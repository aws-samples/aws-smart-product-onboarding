# API common

Shared code for the Python API handlers:

- `amzn_smart_product_onboarding_api_common.models`: pydantic models generated from `packages/api/model/src/main/openapi/main.yaml` with [datamodel-code-generator](https://github.com/koxudaxi/datamodel-code-generator). Fields use snake_case names with the API's camelCase names as aliases.
- `amzn_smart_product_onboarding_api_common.handler`: the `api_handler` decorator that turns an API Gateway proxy event into a typed request and builds the response, including the `x-amzn-errortype` and CORS headers, and the Powertools logger, tracer and metrics.

The models file is checked in, so no generator runs during a normal build. After changing the OpenAPI definition, regenerate it and commit the result:

```shell
pnpm exec nx run amzn-smart-product-onboarding-api-python-common:generate
```

The pull request build regenerates the models and fails if they differ from the committed file.
