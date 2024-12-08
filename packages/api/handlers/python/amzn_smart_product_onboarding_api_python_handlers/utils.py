# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
from typing import Literal, Optional, TYPE_CHECKING

from boto3 import Session
import botocore.exceptions

if TYPE_CHECKING:
    from mypy_boto3_stepfunctions import SFNClient
    from mypy_boto3_dynamodb import DynamoDBServiceResource, DynamoDBClient
    from mypy_boto3_s3 import S3Client
else:
    SFNClient = object
    DynamoDBServiceResource = object
    DynamoDBClient = object
    S3Client = object


def get_sfn_client() -> SFNClient:
    return Session().client("stepfunctions")


def get_dynamodb_client() -> DynamoDBClient:
    return Session().client("dynamodb")


def get_dynamodb_resource() -> DynamoDBServiceResource:
    return Session().resource("dynamodb")


def get_s3_client() -> S3Client:
    return Session().client("s3")


def create_presigned_url(
    client: S3Client,
    logger,
    bucket_name: str,
    object_key: str,
    client_method: str,
    content_type: Optional[str] = None,
    expiration: int = 3600,
):
    """Generate a presigned URL S3 POST request to upload a file

    :param client: boto3 s3 client
    :param logger: logging object
    :param bucket_name: str
    :param object_key: str
    :param client_method: str should be either put_object or get_object
    :param content_type: str Content type to include in Params of call to generate_presigned_url as part of the expected Headers
    :param expiration: Time in seconds for the presigned URL to remain valid
    :return: Dictionary with the following keys:
        url: URL to post to
        fields: Dictionary of form fields and values to submit with the POST
    :return: None if error.
    """

    params = {
        "Bucket": bucket_name,
        "Key": object_key,
    }

    if content_type is not None:
        params["ContentType"] = content_type
        params["ServerSideEncryption"] = "AES256"

    try:
        url = client.generate_presigned_url(ClientMethod=client_method, Params=params, ExpiresIn=expiration)
    except botocore.exceptions.ClientError as e:
        logger.error(e)
        raise

    return url
