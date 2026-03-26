# PresignedUrlResponse

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**url** | **str** | The presigned URL for interacting with S3 (downloading or uploading) | 
**object_key** | **str** | The optional object key | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.presigned_url_response import PresignedUrlResponse

# TODO update the JSON string below
json = "{}"
# create an instance of PresignedUrlResponse from a JSON string
presigned_url_response_instance = PresignedUrlResponse.from_json(json)
# print the JSON string representation of the object
print(PresignedUrlResponse.to_json())

# convert the object into a dict
presigned_url_response_dict = presigned_url_response_instance.to_dict()
# create an instance of PresignedUrlResponse from a dict
presigned_url_response_form_dict = presigned_url_response.from_dict(presigned_url_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

