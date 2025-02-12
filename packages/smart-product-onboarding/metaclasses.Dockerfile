# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

FROM public.ecr.aws/lambda/python:3.13 AS embeddings

# Install the specified packages
RUN dnf install -y gcc g++
RUN --mount=type=cache,target=/root/.cache pip install nltk~=3.9.1

RUN python -m nltk.downloader -d /usr/local/share/nltk_data punkt
RUN python -m nltk.downloader -d /usr/local/share/nltk_data punkt_tab
RUN python -m nltk.downloader -d /usr/local/share/nltk_data stopwords

FROM public.ecr.aws/lambda/python:3.13 AS build

ENV POETRY_CACHE_DIR=/root/.cache/poetry
RUN --mount=type=cache,target=/root/.cache pip install poetry~=1.8.3

# Add local dependencies
RUN mkdir /src
WORKDIR /src

COPY . /src/
# Install the package
WORKDIR /src/metaclasses
RUN --mount=type=cache,target=/root/.cache poetry build
RUN --mount=type=cache,target=/root/.cache poetry run pip cache remove 'amzn_smart_product_onboarding_*'
RUN --mount=type=cache,target=/root/.cache poetry run pip install -t ${LAMBDA_TASK_ROOT} /src/metaclasses/dist/*.whl

FROM public.ecr.aws/lambda/python:3.13
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=embeddings /usr/local/share/nltk_data /usr/local/share/nltk_data
COPY --from=build ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "amzn_smart_product_onboarding_metaclasses.aws_lambda.handler" ]

#checkov:skip=CKV_DOCKER_2:No health check needed for AWS Lambda
#checkov:skip=CKV_DOCKER_3:AWS Lambda manages the user