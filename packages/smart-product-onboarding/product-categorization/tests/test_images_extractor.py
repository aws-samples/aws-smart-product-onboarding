# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import io
import os
import zipfile
from unittest.mock import Mock, patch

import pytest
from moto import mock_aws

from amzn_smart_product_onboarding_core_utils.boto3_helper.s3_client import S3Client
from amzn_smart_product_onboarding_product_categorization.images_extractor import (
    ImagesExtractor,
    extract_images_from_zip,
    is_supported_image,
    get_content_type,
)


def create_test_bucket(s3_client, bucket_name):
    """Create S3 bucket with proper region configuration for tests."""
    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
    
    if region == "us-east-1":
        s3_client.create_bucket(Bucket=bucket_name)
    else:
        s3_client.create_bucket(
            Bucket=bucket_name,
            CreateBucketConfiguration={"LocationConstraint": region}
        )


@pytest.fixture()
def test_zip_file():
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w") as zip_file:
        # Add image files
        zip_file.writestr("test1.jpg", b"\xFF\xD8\xFFfake jpg data")
        zip_file.writestr("subfolder/test2.png", b"\x89PNG\r\n\x1a\nfake png data")
        zip_file.writestr("test3.webp", b"RIFF\x00\x00\x00\x00WEBPfake webp data")
        # Add non-image files
        zip_file.writestr("document.txt", b"text content")
        zip_file.writestr("subfolder/data.csv", b"csv content")

    zip_buffer.seek(0)
    return zip_buffer


# Unit Tests
def test_is_supported_image():
    assert is_supported_image("test.jpg") is True
    assert is_supported_image("test.PNG") is True
    assert is_supported_image("test.txt") is False
    assert is_supported_image("test") is False


def test_get_content_type(test_zip_file):
    with zipfile.ZipFile(test_zip_file) as zip_ref:
        image_files = extract_images_from_zip(zip_ref)
        assert get_content_type(zip_ref.read(image_files[0])) == "image/jpeg"
        assert get_content_type(zip_ref.read(image_files[1])) == "image/png"
        assert get_content_type(zip_ref.read(image_files[2])) == "image/webp"
        assert get_content_type(zip_ref.read("document.txt")) == "application/octet-stream"
        assert get_content_type(zip_ref.read("subfolder/data.csv")) == "application/octet-stream"


def test_extract_images_from_zip(test_zip_file):
    with zipfile.ZipFile(test_zip_file) as zip_ref:
        image_files = extract_images_from_zip(zip_ref)
        assert len(image_files) == 3
        filenames = [f.filename for f in image_files]
        assert "test1.jpg" in filenames
        assert "subfolder/test2.png" in filenames
        assert "test3.webp" in filenames
        assert "document.txt" not in filenames


class TestImagesExtractor:
    @pytest.fixture
    def mock_s3(self):
        s3_mock = Mock()
        return s3_mock

    @pytest.fixture
    def extractor(self, mock_s3):
        return ImagesExtractor(mock_s3, "test-bucket")

    def test_upload_image_to_s3(self, extractor):
        image_data = b"\xFF\xD8\xFFfake image data"
        extractor.upload_image_to_s3("test.jpg", image_data)
        extractor.s3.put_object.assert_called_once_with(
            Bucket="test-bucket", Key="test.jpg", Body=image_data, ContentType="image/jpeg"
        )

    def test_process_zip_file(self, extractor, test_zip_file):
        # Mock S3 download

        def mock_download(bucket, key, file_obj):
            file_obj.write(test_zip_file.getvalue())

        extractor.s3.download_fileobj = Mock(side_effect=mock_download)

        # Test process_zip_file
        extractor.process_zip_file("test.zip", "prefix")

        # Verify upload calls
        assert extractor.s3.put_object.call_count == 3
        upload_keys = [call[1]["Key"] for call in extractor.s3.put_object.call_args_list]
        assert "prefix/test1.jpg" in upload_keys
        assert "prefix/subfolder/test2.png" in upload_keys
        assert "prefix/test3.webp" in upload_keys


# Integration Tests
@mock_aws
def test_images_extractor_integration(test_zip_file):
    import boto3

    # Setup
    s3_client: S3Client = boto3.client("s3")
    bucket = "test-bucket"
    create_test_bucket(s3_client, bucket)

    # Create and upload test zip
    s3_client.put_object(Bucket=bucket, Key="test.zip", Body=test_zip_file.getvalue())

    # Initialize extractor with real (mocked) S3 client
    extractor = ImagesExtractor(s3_client, bucket)

    # Process zip file
    extractor.process_zip_file("test.zip", "output")

    # Verify results
    objects = s3_client.list_objects_v2(Bucket=bucket)["Contents"]
    uploaded_keys = [obj["Key"] for obj in objects]

    assert "output/test1.jpg" in uploaded_keys
    assert "output/subfolder/test2.png" in uploaded_keys
    assert "output/test3.webp" in uploaded_keys

    # Verify content
    response = s3_client.get_object(Bucket=bucket, Key="output/test1.jpg")
    assert response["Body"].read() == b"\xFF\xD8\xFFfake jpg data"


@mock_aws
def test_images_extractor_integration_empty_zip():
    import boto3

    # Setup
    s3_client: S3Client = boto3.client("s3")
    bucket = "test-bucket"
    create_test_bucket(s3_client, bucket)

    # Create empty zip
    empty_zip = io.BytesIO()
    with zipfile.ZipFile(empty_zip, "w"):
        pass

    s3_client.put_object(Bucket=bucket, Key="empty.zip", Body=empty_zip.getvalue())

    # Initialize extractor
    extractor = ImagesExtractor(s3_client, bucket)

    # Process empty zip
    extractor.process_zip_file("empty.zip", "output")

    # Verify no images were uploaded
    objects = s3_client.list_objects_v2(Bucket=bucket)["Contents"]
    assert len(objects) == 1  # Only the original zip file
    assert objects[0]["Key"] == "empty.zip"
