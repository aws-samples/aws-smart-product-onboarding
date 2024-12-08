# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import csv
import json
import logging
import os
import tempfile
from collections import OrderedDict
from io import BytesIO
from typing import TypedDict, List, Literal, Iterator

from boto3.session import Session

log_level = os.getenv("LOG_LEVEL", default="INFO")

logger = logging.getLogger()
logger.setLevel(logging.getLevelName(log_level))

RESULT_BUCKET = os.getenv("RESULT_BUCKET")
RESULT_PREFIX = os.getenv("RESULT_PREFIX")


class ResultWriterDetails(TypedDict):
    Bucket: str
    Key: str


class SfnDistMapCompleteEvent(TypedDict):
    inputKey: str
    ResultWriterDetails: ResultWriterDetails


class ResultFiles(TypedDict):
    Key: str
    Size: int


class ResultStatus(TypedDict):
    FAILED: List[ResultFiles]
    SUCCEEDED: List[ResultFiles]
    PENDING: List[ResultFiles]


class Manifest(TypedDict):
    DestinationBucket: str
    MapRunArn: str
    ResultFiles: ResultStatus


class IODetails(TypedDict):
    Included: bool


class Result(TypedDict):
    ExecutionArn: str
    Input: str
    InputDetails: IODetails
    Output: str
    OutputDetails: IODetails
    Name: str
    Status: Literal["SUCCEEDED", "FAILED", "PENDING"]
    StartDate: str
    StopDate: str
    StateMachineArn: str


def get_manifest(s3, bucket, key) -> Manifest:
    with BytesIO() as data:
        s3.download_fileobj(bucket, key, data)
        data.seek(0)
        manifest: Manifest = json.load(data)
        if "ResultFiles" not in manifest:
            raise ValueError("Manifest does not contain ResultFiles")
        return manifest


def get_results(s3, bucket, key):
    with BytesIO() as data:
        s3.download_fileobj(bucket, key, data)
        data.seek(0)
        results: List[Result] = json.load(data)
        if not isinstance(results, list):
            raise ValueError("Results is not a list")
        return results


def check_manifest_status(manifest: Manifest) -> bool:
    if (len(manifest["ResultFiles"]["FAILED"]) > 0) or (len(manifest["ResultFiles"]["PENDING"]) > 0):
        return False
    if len(manifest["ResultFiles"]["SUCCEEDED"]) > 0:
        return True


def result_output(s3, manifest: Manifest, status: Literal["SUCCEEDED", "FAILED", "PENDING"]) -> Iterator[Result]:
    for result in manifest["ResultFiles"][status]:
        results = get_results(s3, manifest["DestinationBucket"], result["Key"])
        for r in results:
            yield r


def get_s3_client():
    return Session().client("s3")


def serialize_objects(row: dict) -> dict:
    """For any value that is not a string or a number, serialize it as JSON."""
    output = {}
    for key, value in row.items():
        if not isinstance(value, (str, int, float)):
            output[key] = json.dumps(value)
        else:
            output[key] = value
    return output


def handler(e: SfnDistMapCompleteEvent, _context):
    logger.info(f"Event: {json.dumps(e)}")

    if RESULT_BUCKET is None or RESULT_PREFIX is None:
        raise Exception("Missing environment variables for Buckets!")

    s3 = get_s3_client()

    logger.info("Processing result manifest")
    manifest = get_manifest(s3, e["ResultWriterDetails"]["Bucket"], e["ResultWriterDetails"]["Key"])
    if not check_manifest_status(manifest):
        logger.warning(f"Manifest contains failed executions: {manifest['MapRunArn']}")

    with tempfile.NamedTemporaryFile("w", delete_on_close=False) as output:
        success_results = result_output(s3, manifest, "SUCCEEDED")
        first_row = next(success_results)
        first_input: OrderedDict = json.loads(first_row["Input"], object_pairs_hook=OrderedDict)["input"]
        first_output: OrderedDict = json.loads(first_row["Output"], object_pairs_hook=OrderedDict)
        row = first_input | first_output
        writer = csv.DictWriter(output, fieldnames=row.keys(), extrasaction="ignore", restval="")
        writer.writeheader()
        writer.writerow(serialize_objects(row))
        for row in success_results:
            writer.writerow(json.loads(row["Input"])["input"] | serialize_objects(json.loads(row["Output"])))

        for row in result_output(s3, manifest, "FAILED"):
            writer.writerow(json.loads(row["Input"])["input"])

        for row in result_output(s3, manifest, "PENDING"):
            writer.writerow(json.loads(row["Input"])["input"])

        output.close()
        # nosemgrep:tempfile-without-flush - False positive
        s3.upload_file(output.name, RESULT_BUCKET, RESULT_PREFIX + e["inputKey"])
        logger.info(f"Uploaded results to {RESULT_BUCKET}/{RESULT_PREFIX}{e['inputKey']}")

    return {
        "Bucket": RESULT_BUCKET,
        "Key": RESULT_PREFIX + e["inputKey"],
    }
