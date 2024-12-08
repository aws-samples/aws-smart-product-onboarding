# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import pytest
from moto import mock_aws
import boto3
from datetime import datetime, timedelta
from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import BatchExecution, BatchExecutionStatus
from amzn_smart_product_onboarding_api_python_handlers.repository import ResourceNotFound, DynamoDBSessionRepository


@pytest.fixture
def dynamodb():
    with mock_aws():
        yield boto3.resource("dynamodb", region_name="us-east-1")


@pytest.fixture
def table(dynamodb):
    # Create the DynamoDB table
    table = dynamodb.create_table(
        TableName="test-table",
        KeySchema=[
            {"AttributeName": "session_id", "KeyType": "HASH"},
        ],
        AttributeDefinitions=[
            {"AttributeName": "session_id", "AttributeType": "S"},
            {"AttributeName": "type", "AttributeType": "S"},
            {"AttributeName": "created_at", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[
            {
                "IndexName": "type-created_at-index",
                "KeySchema": [
                    {"AttributeName": "type", "KeyType": "HASH"},
                    {"AttributeName": "created_at", "KeyType": "RANGE"},
                ],
                "Projection": {"ProjectionType": "ALL"},
                "ProvisionedThroughput": {"ReadCapacityUnits": 1, "WriteCapacityUnits": 1},
            }
        ],
        ProvisionedThroughput={"ReadCapacityUnits": 1, "WriteCapacityUnits": 1},
    )
    return table


@pytest.fixture
def repository(table):
    return DynamoDBSessionRepository(table=table, created_at_index_name="type-created_at-index")


def test_get_existing_item(repository, table):
    # Arrange
    item = {
        "session_id": "test-id",
        "type": "Session",
        "status": "SUCCESS",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T01:00:00Z",
        "date": "2023-01-01",
        "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    }
    table.put_item(Item=item)

    # Act
    result = repository.get("test-id")

    # Assert
    assert isinstance(result, BatchExecution)
    assert result.execution_id == "test-id"
    assert result.status == BatchExecutionStatus.SUCCESS
    assert result.created_at == "2023-01-01T00:00:00Z"
    assert result.updated_at == "2023-01-01T01:00:00Z"
    assert result.error is None


def test_get_nonexistent_item(repository):
    # Act & Assert
    with pytest.raises(ResourceNotFound):
        repository.get("nonexistent-id")


def test_get_item_with_error(repository, table):
    # Arrange
    item = {
        "session_id": "test-id",
        "type": "Session",
        "status": "ERROR",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T01:00:00Z",
        "error": "Something went wrong",
        "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "date": "2023-01-01",
    }
    table.put_item(Item=item)

    # Act
    result = repository.get("test-id")

    # Assert
    assert result.error == "Something went wrong"
    assert result.status == BatchExecutionStatus.ERROR


def test_get_item_with_extra_fields(repository, table):
    # Arrange
    item = {
        "session_id": "test-id",
        "type": "Session",
        "status": "SUCCESS",
        "created_at": "2023-01-01T00:00:00Z",
        "updated_at": "2023-01-01T01:00:00Z",
        "date": "2023-01-01",
        "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "extra_field": "extra_value",
    }
    table.put_item(Item=item)

    # Act
    result = repository.get("test-id")

    # Assert
    assert result.to_dict().keys() == {
        "executionId",
        "status",
        "createdAt",
        "updatedAt",
    }


def test_list_with_date_range(repository, table):
    # Arrange
    reference_time = datetime.now()
    items = [
        {
            "session_id": f"test-id-{i}",
            "type": "Session",
            "status": "SUCCESS",
            "created_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "updated_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "date": (reference_time - timedelta(days=i)).strftime("%Y-%m-%d"),
            "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        }
        for i in range(0, 9, 3)
    ]

    for item in items:
        table.put_item(Item=item)

    start_date = (reference_time - timedelta(days=4)).isoformat() + "Z"
    end_date = reference_time.isoformat() + "Z"

    # Act
    results = repository.list(date_range=(start_date, end_date))

    # Assert
    assert len(results) == 2
    assert all(isinstance(result, BatchExecution) for result in results)


def test_list_with_start_date_only(repository, table):
    # Arrange
    reference_time = datetime.now()
    items = [
        {
            "session_id": f"test-id-{i}",
            "type": "Session",
            "status": "SUCCESS",
            "created_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "updated_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "date": (reference_time - timedelta(days=i)).strftime("%Y-%m-%d"),
            "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        }
        for i in range(0, 9, 3)
    ]

    for item in items:
        table.put_item(Item=item)

    start_date = (reference_time - timedelta(days=2)).isoformat() + "Z"

    # Act
    results = repository.list(date_range=(start_date, None))

    # Assert
    assert len(results) == 1
    assert all(isinstance(result, BatchExecution) for result in results)
    assert results[0].execution_id == "test-id-0"


def test_list_without_created_at_index(table):
    # Arrange
    repository = DynamoDBSessionRepository(table=table)

    # Act & Assert
    with pytest.raises(RuntimeError, match="Missing createdAt index name"):
        repository.list()


def test_list_empty_results(repository):
    # Act
    results = repository.list()

    # Assert
    assert len(results) == 0


def test_list_with_extra_fields(repository, table):
    # Arrange
    reference_time = datetime.now()
    items = [
        {
            "session_id": f"test-id-{i}",
            "type": "Session",
            "status": "SUCCESS",
            "created_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "updated_at": (reference_time - timedelta(days=i)).isoformat() + "Z",
            "date": (reference_time - timedelta(days=i)).strftime("%Y-%m-%d"),
            "execution_arn": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            "extra_field": "extra_value",
        }
        for i in range(3)
    ]

    for item in items:
        table.put_item(Item=item)

    # Act
    results = repository.list()

    # Assert
    assert len(results) == 3
    assert all(isinstance(result, BatchExecution) for result in results)
    assert all(not hasattr(result, "extra_field") for result in results)
