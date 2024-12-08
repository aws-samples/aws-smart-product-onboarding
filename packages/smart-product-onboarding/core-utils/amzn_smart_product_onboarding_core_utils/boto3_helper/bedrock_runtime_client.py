# Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import os
import boto3
from botocore.config import Config
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient
else:
    BedrockRuntimeClient = object

BEDROCK_XACCT_ROLE = os.getenv("BEDROCK_XACCT_ROLE")
BEDROCK_XACCT_REGION = os.getenv("BEDROCK_XACCT_REGION", "us-west-2")  # we assume cross-account role happens in PDX by default

if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    client_kwargs = {"region_name": os.getenv("AWS_REGION", "us-east-1")}

    if BEDROCK_XACCT_ROLE:
        sts = boto3.client("sts", config=Config(retries={"max_attempts": 3, "mode": "adaptive"}))

        response = sts.assume_role(
            RoleArn=BEDROCK_XACCT_ROLE,
            RoleSessionName="x-acct-role-for-smart-product-onboarding"
        )

        client_kwargs["aws_access_key_id"] = response["Credentials"]["AccessKeyId"]
        client_kwargs["aws_secret_access_key"] = response["Credentials"]["SecretAccessKey"]
        client_kwargs["aws_session_token"] = response["Credentials"]["SessionToken"]

        # x-acct region
        client_kwargs["region_name"] = BEDROCK_XACCT_REGION

    retry_config = Config(
        region_name=client_kwargs["region_name"],
        connect_timeout=120,
        read_timeout=120,
        retries={
            "max_attempts": 10,
            "mode": "adaptive",
        },
    )

    LAMBDA_BEDROCK_RUNTIME_CLIENT: BedrockRuntimeClient = boto3.client(
        "bedrock-runtime",
        config=retry_config,
        **client_kwargs
    )
else:
    LAMBDA_BEDROCK_RUNTIME_CLIENT = object
