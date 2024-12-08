# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from abc import ABC, abstractmethod
from typing import Optional

from amzn_smart_product_onboarding_api_python_runtime.api.operation_config import BatchExecution


class ResourceNotFound(Exception): ...


class AbstractRepository(ABC):
    @abstractmethod
    def list(self, date_range: Optional[tuple[str, str]] = None) -> list[BatchExecution]: ...

    @abstractmethod
    def get(self, execution_id: str) -> BatchExecution: ...
