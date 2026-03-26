# CategorizeProductRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**product** | [**ProductData**](ProductData.md) |  | 
**possible_categories** | **List[str]** |  | 
**demo** | **bool** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.categorize_product_request_content import CategorizeProductRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of CategorizeProductRequestContent from a JSON string
categorize_product_request_content_instance = CategorizeProductRequestContent.from_json(json)
# print the JSON string representation of the object
print(CategorizeProductRequestContent.to_json())

# convert the object into a dict
categorize_product_request_content_dict = categorize_product_request_content_instance.to_dict()
# create an instance of CategorizeProductRequestContent from a dict
categorize_product_request_content_form_dict = categorize_product_request_content.from_dict(categorize_product_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

