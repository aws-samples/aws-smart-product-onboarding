# GenProductRequestContent

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**language** | **str** | The language of the product description. You can specify a natural description of the language. | [optional] 
**description_length** | [**GenProductRequestContentDescriptionLengthEnum**](GenProductRequestContentDescriptionLengthEnum.md) |  | [optional] 
**product_images** | **List[str]** | The S3 keys of the images for the product. | 
**metadata** | **str** | Metadata for the product from the manufacturer or distributor. | [optional] 
**temperature** | **float** | The level for randomness for the LLM. | [optional] 
**model** | [**GenProductRequestContentModelEnum**](GenProductRequestContentModelEnum.md) |  | [optional] 
**examples** | **List[ProductData]** | Examples of good product descriptions with the desired tone and language. | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.gen_product_request_content import GenProductRequestContent

# TODO update the JSON string below
json = "{}"
# create an instance of GenProductRequestContent from a JSON string
gen_product_request_content_instance = GenProductRequestContent.from_json(json)
# print the JSON string representation of the object
print(GenProductRequestContent.to_json())

# convert the object into a dict
gen_product_request_content_dict = gen_product_request_content_instance.to_dict()
# create an instance of GenProductRequestContent from a dict
gen_product_request_content_form_dict = gen_product_request_content.from_dict(gen_product_request_content_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

