# BatchExecution

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**execution_id** | **str** | The ID of the batch execution | 
**created_at** | **str** | The date and time the execution was created in ISO 8601 format | 
**updated_at** | **str** | The date and time the execution was last updated in ISO 8601 format | 
**status** | [**BatchExecutionStatus**](BatchExecutionStatus.md) |  | 
**error** | **str** | The error message if the execution failed | [optional] 
**output_key** | **str** | The s3 key for the output file | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.batch_execution import BatchExecution

# TODO update the JSON string below
json = "{}"
# create an instance of BatchExecution from a JSON string
batch_execution_instance = BatchExecution.from_json(json)
# print the JSON string representation of the object
print(BatchExecution.to_json())

# convert the object into a dict
batch_execution_dict = batch_execution_instance.to_dict()
# create an instance of BatchExecution from a dict
batch_execution_form_dict = batch_execution.from_dict(batch_execution_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

