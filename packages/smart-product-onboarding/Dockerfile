# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

FROM public.ecr.aws/lambda/python:3.12 AS build

ENV POETRY_CACHE_DIR=/root/.cache/poetry
RUN --mount=type=cache,target=/root/.cache pip install poetry~=1.8.3

# Add local dependencies
RUN mkdir /src
WORKDIR /src

COPY . /src/

# Install the package
WORKDIR /src/product-categorization
RUN --mount=type=cache,target=/root/.cache poetry build
RUN --mount=type=cache,target=/root/.cache poetry run pip cache remove 'amzn_smart_product_onboarding_*'
RUN --mount=type=cache,target=/root/.cache poetry run pip install -t ${LAMBDA_TASK_ROOT} /src/product-categorization/dist/*.whl

FROM public.ecr.aws/lambda/python:3.12
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=build ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "amzn_smart_product_onboarding_product_categorization.aws_lambda.categorization.handler" ]

#checkov:skip=CKV_DOCKER_2:No health check needed for AWS Lambda
#checkov:skip=CKV_DOCKER_3:AWS Lambda manages the user