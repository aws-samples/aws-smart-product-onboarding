# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from amzn_smart_product_onboarding_api_runtime.models import BatchExecutionStatus

# shortcut: the PDK-generated models serialize enum properties with `status.to_dict()`, but the generated
# enums define no to_dict, so batch responses failed with AttributeError (HTTP 502). Remove this when the
# generated runtime serializes enum values itself.
if not hasattr(BatchExecutionStatus, "to_dict"):
    BatchExecutionStatus.to_dict = lambda self: self.value
