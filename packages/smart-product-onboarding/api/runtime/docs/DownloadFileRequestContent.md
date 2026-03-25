# DownloadFileRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**output_key** | **str** |  | 
**expiration** | **int** | The expiration, in seconds for the generated URL | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.download_file_request_content import DownloadFileRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of DownloadFileRequestContent from a JSON string
download_file_request_content_instance = DownloadFileRequestContent.from_json(json)
# print the JSON string representation of the object
print(DownloadFileRequestContent.to_json())

# convert the object into a dict
download_file_request_content_dict = download_file_request_content_instance.to_dict()
# create an instance of DownloadFileRequestContent from a dict
download_file_request_content_form_dict = download_file_request_content.from_dict(download_file_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

