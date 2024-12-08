# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import zipfile
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

from amzn_smart_product_onboarding_core_utils.logger import logger

from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import S3Client

logger.name = "images_extractor"

SUPPORTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"]


class ImagesExtractor:
    def __init__(self, s3: S3Client, bucket: str):
        self.s3 = s3
        self.bucket = bucket

    def upload_image_to_s3(self, key: str, image_data: bytes) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=image_data, ContentType=get_content_type(image_data))

    def process_zip_file(self, key: str, image_prefix: str) -> None:
        with io.BytesIO() as tmpfile:
            self.s3.download_fileobj(self.bucket, key, tmpfile)
            tmpfile.seek(0)

            with zipfile.ZipFile(tmpfile, "r") as zip_ref:
                image_files = extract_images_from_zip(zip_ref)

                def upload_image(img_file):
                    logger.debug(f"Extracting and uploading {img_file.filename}")
                    image_data = zip_ref.read(img_file)
                    self.upload_image_to_s3(f"{image_prefix}/{img_file.filename}", image_data)

                with ThreadPoolExecutor(max_workers=10) as executor:
                    futures = [executor.submit(upload_image, img_file) for img_file in image_files]
                    for future in as_completed(futures):
                        future.result()


def is_supported_image(filename: str) -> bool:
    return filename.split(".")[-1].lower() in SUPPORTED_IMAGE_EXTENSIONS


def extract_images_from_zip(zip_ref: zipfile.ZipFile) -> list[zipfile.ZipInfo]:
    return [img for img in zip_ref.infolist() if is_supported_image(img.filename)]


def get_content_type(data: bytes) -> str:
    signatures = {
        b"\xFF\xD8\xFF": "image/jpeg",
        b"\x89PNG\r\n\x1a\n": "image/png",
        b"GIF87a": "image/gif",
        b"GIF89a": "image/gif",
    }
    for signature, mime_type in signatures.items():
        if data.startswith(signature):
            return mime_type

    # Special case for WEBP
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"
