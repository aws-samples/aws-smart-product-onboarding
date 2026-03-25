# ProductData

Customer facing product data.
## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | 
**description** | **str** |  | 
**short_description** | **str** |  | [optional] 
**metadata** | **str** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.product_data import ProductData

# TODO update the JSON string below
json = "{}"
# create an instance of ProductData from a JSON string
product_data_instance = ProductData.from_json(json)
# print the JSON string representation of the object
print(ProductData.to_json())

# convert the object into a dict
product_data_dict = product_data_instance.to_dict()
# create an instance of ProductData from a dict
product_data_form_dict = product_data.from_dict(product_data_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

