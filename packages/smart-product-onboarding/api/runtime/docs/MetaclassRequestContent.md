# MetaclassRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**product** | [**ProductData**](ProductData.md) |  | 
**demo** | **bool** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.metaclass_request_content import MetaclassRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of MetaclassRequestContent from a JSON string
metaclass_request_content_instance = MetaclassRequestContent.from_json(json)
# print the JSON string representation of the object
print(MetaclassRequestContent.to_json())

# convert the object into a dict
metaclass_request_content_dict = metaclass_request_content_instance.to_dict()
# create an instance of MetaclassRequestContent from a dict
metaclass_request_content_form_dict = metaclass_request_content.from_dict(metaclass_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

