# ExtractAttributesRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**product** | [**ProductData**](ProductData.md) |  | 
**category_id** | **str** |  | 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.extract_attributes_request_content import ExtractAttributesRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of ExtractAttributesRequestContent from a JSON string
extract_attributes_request_content_instance = ExtractAttributesRequestContent.from_json(json)
# print the JSON string representation of the object
print(ExtractAttributesRequestContent.to_json())

# convert the object into a dict
extract_attributes_request_content_dict = extract_attributes_request_content_instance.to_dict()
# create an instance of ExtractAttributesRequestContent from a dict
extract_attributes_request_content_form_dict = extract_attributes_request_content.from_dict(extract_attributes_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

