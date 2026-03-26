# UploadFileRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**file_name** | **str** |  | 
**expiration** | **int** | The expiration, in seconds for the generated URL | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.upload_file_request_content import UploadFileRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of UploadFileRequestContent from a JSON string
upload_file_request_content_instance = UploadFileRequestContent.from_json(json)
# print the JSON string representation of the object
print(UploadFileRequestContent.to_json())

# convert the object into a dict
upload_file_request_content_dict = upload_file_request_content_instance.to_dict()
# create an instance of UploadFileRequestContent from a dict
upload_file_request_content_form_dict = upload_file_request_content.from_dict(upload_file_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

