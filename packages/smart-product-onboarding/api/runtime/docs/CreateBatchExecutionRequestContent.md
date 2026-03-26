# CreateBatchExecutionRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input_file** | **str** | The s3 key for the csv file containing the input data | 
**compressed_images_file** | **str** | The s3 key for the zip file containing the product images | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.create_batch_execution_request_content import CreateBatchExecutionRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of CreateBatchExecutionRequestContent from a JSON string
create_batch_execution_request_content_instance = CreateBatchExecutionRequestContent.from_json(json)
# print the JSON string representation of the object
print(CreateBatchExecutionRequestContent.to_json())

# convert the object into a dict
create_batch_execution_request_content_dict = create_batch_execution_request_content_instance.to_dict()
# create an instance of CreateBatchExecutionRequestContent from a dict
create_batch_execution_request_content_form_dict = create_batch_execution_request_content.from_dict(create_batch_execution_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

