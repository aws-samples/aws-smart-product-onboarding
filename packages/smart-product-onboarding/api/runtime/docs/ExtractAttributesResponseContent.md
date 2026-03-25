# ExtractAttributesResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**attributes** | **List[ProductAttribute]** |  | 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.extract_attributes_response_content import ExtractAttributesResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of ExtractAttributesResponseContent from a JSON string
extract_attributes_response_content_instance = ExtractAttributesResponseContent.from_json(json)
# print the JSON string representation of the object
print(ExtractAttributesResponseContent.to_json())

# convert the object into a dict
extract_attributes_response_content_dict = extract_attributes_response_content_instance.to_dict()
# create an instance of ExtractAttributesResponseContent from a dict
extract_attributes_response_content_form_dict = extract_attributes_response_content.from_dict(extract_attributes_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

