# MetaclassResponseContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**possible_categories** | **List[str]** |  | 
**clean_title** | **str** |  | [optional] 
**findings** | **List[WordFinding]** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.metaclass_response_content import MetaclassResponseContent

# TODO update the JSON string below
json = "{}"
# create an instance of MetaclassResponseContent from a JSON string
metaclass_response_content_instance = MetaclassResponseContent.from_json(json)
# print the JSON string representation of the object
print(MetaclassResponseContent.to_json())

# convert the object into a dict
metaclass_response_content_dict = metaclass_response_content_instance.to_dict()
# create an instance of MetaclassResponseContent from a dict
metaclass_response_content_form_dict = metaclass_response_content.from_dict(metaclass_response_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

