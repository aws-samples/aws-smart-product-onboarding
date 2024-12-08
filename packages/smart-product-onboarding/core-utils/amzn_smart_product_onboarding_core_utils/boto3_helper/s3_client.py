# Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import os
import boto3
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_s3 import S3Client, S3ServiceResource
else:
    S3Client = object
    S3ServiceResource = object


if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    LAMBDA_S3_CLIENT: S3Client = boto3.client("s3")
    LAMBDA_S3_RESOURCE: S3ServiceResource = boto3.resource("s3")
else:
    LAMBDA_S3_CLIENT = object
    LAMBDA_S3_RESOURCE = object


def get_s3_object_body(s3: S3Client, bucket: str, key: str) -> bytes:
    return s3.get_object(Bucket=bucket, Key=key)["Body"].read()
