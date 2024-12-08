# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

import json
from typing import TYPE_CHECKING, Optional
from boto3.dynamodb.conditions import Key

from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import BatchExecution
from amzn_smart_product_onboarding_api_python_handlers.repository import AbstractRepository, ResourceNotFound

if TYPE_CHECKING:
    from mypy_boto3_stepfunctions import SFNClient
    from mypy_boto3_dynamodb.service_resource import Table
    from mypy_boto3_dynamodb.paginator import QueryPaginator
else:
    SFNClient = object
    Table = object
    QueryPaginator = object


class DynamoDBSessionRepository(AbstractRepository):
    def __init__(
        self,
        table: Table,
        created_at_index_name: Optional[str] = None,
        partition_key: str = "session_id",
        sfn: Optional[SFNClient] = None,
    ):
        self.table = table
        self.created_at_index_name = created_at_index_name
        self.partition_key = partition_key
        self.sfn = sfn

    def get(self, execution_id: str) -> BatchExecution:
        response = self.table.get_item(Key={self.partition_key: execution_id})

        if "Item" not in response:
            raise ResourceNotFound(f"Could not find for id: {execution_id}")

        # we explicitly inform executionId because we shouldn't rely on our table's partition_key name
        execution = BatchExecution.model_validate(
            {"executionId": response["Item"][self.partition_key], **response["Item"]}
        )

        if self.sfn and execution.status == "SUCCESS":
            response = self.sfn.describe_execution(executionArn=response["Item"]["execution_arn"])
            output = json.loads(response["output"])
            output_key = output.get("output", {}).get("Key", None)
            if output_key:
                execution.output_key = output_key
            else:
                raise ResourceNotFound(f"Output key not found in successful execution {execution.execution_arn}")

        return execution

    def list(
        self,
        date_range: Optional[tuple[str, str]] = None,
    ) -> list[BatchExecution]:
        """

        :param date_range: {tuple[str,str]} Optional date range tuple, default: None
        :return: {list[BatchExecution]} list of {BatchExecution} within {date_range}
        """

        if not self.created_at_index_name:
            raise RuntimeError("Missing createdAt index name")

        paginator: QueryPaginator = self.table.meta.client.get_paginator("query")

        query_params = {
            "TableName": self.table.name,
            "IndexName": self.created_at_index_name,
        }

        start_date, end_date = date_range if date_range else (None, None)

        if start_date and end_date:
            query_params["KeyConditionExpression"] = Key("type").eq("Session") & Key("created_at").between(
                start_date, end_date
            )
        elif start_date:
            query_params["KeyConditionExpression"] = Key("type").eq("Session") & Key("created_at").gte(start_date)
        elif end_date:
            query_params["KeyConditionExpression"] = Key("type").eq("Session") & Key("created_at").lte(end_date)
        else:
            query_params["KeyConditionExpression"] = Key("type").eq("Session")

        items = []

        page_iterator = paginator.paginate(**query_params)

        for page in page_iterator:
            items.extend(page.get("Items", []))

        return [BatchExecution(execution_id=item[self.partition_key], **item) for item in items]
