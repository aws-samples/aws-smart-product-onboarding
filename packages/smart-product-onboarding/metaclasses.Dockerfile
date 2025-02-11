# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

FROM public.ecr.aws/lambda/python:3.12 AS embeddings

# Install the specified packages
RUN dnf install -y gcc g++
RUN --mount=type=cache,target=/root/.cache pip install gensim~=4.3.3 nltk~=3.9.1

RUN python -m nltk.downloader -d /usr/local/share/nltk_data punkt
RUN python -m nltk.downloader -d /usr/local/share/nltk_data punkt_tab
RUN python -m nltk.downloader -d /usr/local/share/nltk_data stopwords

##English Embeddings
#ARG EMBEDDINGS_MODEL_URL="https://dl.fbaipublicfiles.com/fasttext/vectors-english/crawl-300d-2M.vec.zip"
#ENV EMBEDDINGS_MODEL_URL=${EMBEDDINGS_MODEL_URL}
#
## Prepare embeddings files
#COPY metaclasses/script_embeddings.py /tmp
#RUN mkdir /opt/wordvectors
#WORKDIR /opt/wordvectors
#RUN --mount=type=cache,target=/root/.cache/embeddings CACHE_DIR=/root/.cache/embeddings python -u /tmp/script_embeddings.py

FROM public.ecr.aws/lambda/python:3.12 AS build

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

FROM public.ecr.aws/lambda/python:3.12
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=embeddings /usr/local/share/nltk_data /usr/local/share/nltk_data
#COPY --from=embeddings /opt/wordvectors /opt/wordvectors
COPY --from=build ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}

# Set the CMD to your handler (could also be done as a parameter override outside of the Dockerfile)
CMD [ "amzn_smart_product_onboarding_metaclasses.aws_lambda.handler" ]

#checkov:skip=CKV_DOCKER_2:No health check needed for AWS Lambda
#checkov:skip=CKV_DOCKER_3:AWS Lambda manages the user