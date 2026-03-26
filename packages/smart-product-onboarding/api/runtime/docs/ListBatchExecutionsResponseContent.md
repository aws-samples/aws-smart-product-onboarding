# ListBatchExecutionsResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**executions** | **List[BatchExecution]** | Foo | 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.list_batch_executions_response_content import ListBatchExecutionsResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of ListBatchExecutionsResponseContent from a JSON string
list_batch_executions_response_content_instance = ListBatchExecutionsResponseContent.from_json(json)
# print the JSON string representation of the object
print(ListBatchExecutionsResponseContent.to_json())

# convert the object into a dict
list_batch_executions_response_content_dict = list_batch_executions_response_content_instance.to_dict()
# create an instance of ListBatchExecutionsResponseContent from a dict
list_batch_executions_response_content_form_dict = list_batch_executions_response_content.from_dict(list_batch_executions_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

