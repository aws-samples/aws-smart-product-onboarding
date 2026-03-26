# WordFinding

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**position** | **int** |  | [optional] 
**type** | **str** |  | [optional] 
**word** | **str** |  | [optional] 
**score** | **float** |  | [optional] 

## Example

```python
from amzn_smart_product_onboarding_api_runtime.models.word_finding import WordFinding

# TODO update the JSON string below
json = "{}"
# create an instance of WordFinding from a JSON string
word_finding_instance = WordFinding.from_json(json)
# print the JSON string representation of the object
print(WordFinding.to_json())

# convert the object into a dict
word_finding_dict = word_finding_instance.to_dict()
# create an instance of WordFinding from a dict
word_finding_form_dict = word_finding.from_dict(word_finding_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)

