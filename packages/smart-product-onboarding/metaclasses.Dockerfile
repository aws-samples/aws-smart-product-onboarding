# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

FROM public.ecr.aws/lambda/python:3.13 AS embeddings

# Install the specified packages
RUN dnf install -y gcc g++
RUN --mount=type=cache,target=/root/.cache pip install nltk~=3.9.1

# Download NLTK data with retry logic and skip punkt_tab if it fails
RUN python -m nltk.downloader -d /usr/local/share/nltk_data punkt || \
    (sleep 5 && python -m nltk.downloader -d /usr/local/share/nltk_data punkt)
RUN python -m nltk.downloader -d /usr/local/share/nltk_data stopwords || \
    (sleep 5 && python -m nltk.downloader -d /usr/local/share/nltk_data stopwords)

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS build

# Set environment variables for uv
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Add local dependencies
RUN mkdir /src
WORKDIR /src

# Copy workspace configuration
COPY pyproject.toml uv.lock ./
COPY README.md ./

# Copy workspace packages
COPY core-utils/ ./core-utils/
COPY api/runtime/ ./api/runtime/
COPY metaclasses/ ./metaclasses/

# Install dependencies and build package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package amzn-smart-product-onboarding-metaclasses

# Export requirements and install for Lambda
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --package amzn-smart-product-onboarding-metaclasses --no-emit-workspace --frozen --no-dev --no-editable -o requirements.txt

# Install to Lambda task root with proper platform targeting
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install \
    --no-installer-metadata \
    --compile-bytecode \
    --target /var/task \
    --python-platform aarch64-unknown-linux-gnu \
    --python-version 3.13 \
    -r requirements.txt

# Build and install workspace packages as wheels
RUN --mount=type=cache,target=/root/.cache/uv \
    uv build --package amzn-smart-product-onboarding-core-utils --out-dir /tmp/wheels

RUN --mount=type=cache,target=/root/.cache/uv \
    uv build --package amzn-smart-product-onboarding-api-runtime --out-dir /tmp/wheels

RUN --mount=type=cache,target=/root/.cache/uv \
    uv build --package amzn-smart-product-onboarding-metaclasses --out-dir /tmp/wheels

# Install workspace packages from wheels
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install \
    --no-installer-metadata \
    --compile-bytecode \
    --target /var/task \
    --python-platform aarch64-unknown-linux-gnu \
    --python-version 3.13 \
    /tmp/wheels/*.whl

FROM public.ecr.aws/lambda/python:3.13
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=embeddings /usr/local/share/nltk_data /usr/local/share/nltk_data
COPY --from=build ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "amzn_smart_product_onboarding_metaclasses.aws_lambda.handler" ]

#checkov:skip=CKV_DOCKER_2:No health check needed for AWS Lambda
#checkov:skip=CKV_DOCKER_3:AWS Lambda manages the user