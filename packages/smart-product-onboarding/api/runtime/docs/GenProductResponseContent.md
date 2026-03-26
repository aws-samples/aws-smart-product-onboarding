# GenProductResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**product** | [**ProductData**](ProductData.md) |  | 
**usage** | [**ModelUsage**](ModelUsage.md) |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.gen_product_response_content import GenProductResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of GenProductResponseContent from a JSON string
gen_product_response_content_instance = GenProductResponseContent.from_json(json)
# print the JSON string representation of the object
print(GenProductResponseContent.to_json())

# convert the object into a dict
gen_product_response_content_dict = gen_product_response_content_instance.to_dict()
# create an instance of GenProductResponseContent from a dict
gen_product_response_content_form_dict = gen_product_response_content.from_dict(gen_product_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

