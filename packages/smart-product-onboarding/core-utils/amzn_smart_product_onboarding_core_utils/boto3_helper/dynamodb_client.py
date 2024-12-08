# Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import os
import boto3
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_dynamodb import DynamoDBClient, DynamoDBServiceResource
else:
    DynamoDBClient = object
    DynamoDBServiceResource = object


if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    LAMBDA_DDB_CLIENT: DynamoDBClient = boto3.client("dynamodb")
    LAMBDA_DDB_RESOURCE: DynamoDBServiceResource = boto3.resource("dynamodb")
else:
    LAMBDA_DDB_CLIENT = object
    LAMBDA_DDB_RESOURCE = object
