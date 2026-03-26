# CategorizeProductResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**category_id** | **str** |  | 
**category_name** | **str** |  | 
**category_path** | **str** |  | 
**explanation** | **str** |  | [optional] 
**prompt** | **str** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.categorize_product_response_content import CategorizeProductResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of CategorizeProductResponseContent from a JSON string
categorize_product_response_content_instance = CategorizeProductResponseContent.from_json(json)
# print the JSON string representation of the object
print(CategorizeProductResponseContent.to_json())

# convert the object into a dict
categorize_product_response_content_dict = categorize_product_response_content_instance.to_dict()
# create an instance of CategorizeProductResponseContent from a dict
categorize_product_response_content_form_dict = categorize_product_response_content.from_dict(categorize_product_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

