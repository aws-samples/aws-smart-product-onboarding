# StartBatchExecutionResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**execution_id** | **str** |  | [optional] 
**status** | [**BatchExecutionStatus**](BatchExecutionStatus.md) |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.start_batch_execution_response_content import StartBatchExecutionResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of StartBatchExecutionResponseContent from a JSON string
start_batch_execution_response_content_instance = StartBatchExecutionResponseContent.from_json(json)
# print the JSON string representation of the object
print(StartBatchExecutionResponseContent.to_json())

# convert the object into a dict
start_batch_execution_response_content_dict = start_batch_execution_response_content_instance.to_dict()
# create an instance of StartBatchExecutionResponseContent from a dict
start_batch_execution_response_content_form_dict = start_batch_execution_response_content.from_dict(start_batch_execution_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

