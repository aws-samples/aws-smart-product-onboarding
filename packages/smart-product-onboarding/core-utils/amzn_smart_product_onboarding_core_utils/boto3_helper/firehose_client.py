# Copyright 2024 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
# Licensed under the Amazon Software License  http://aws.amazon.com/asl/

import os
import boto3
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # mypy_boto3_* is a test-dependency only and not available at runtime
    # It is also only ever used as type-hints, so we can import it during TYPE_CHECKING only
    from mypy_boto3_firehose import FirehoseClient
else:
    FirehoseClient = object

if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    LAMBDA_FIREHOSE_CLIENT: FirehoseClient = boto3.client("firehose")
else:
    LAMBDA_FIREHOSE_CLIENT = object
