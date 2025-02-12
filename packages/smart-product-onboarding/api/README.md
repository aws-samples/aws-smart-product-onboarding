# Smart Product Onboarding API


This Python package is automatically generated.

- API version: 1.0.0

## Requirements.

Python 3.7+

## Getting Started

See the following example for usage:

```python
import time
import amzn_smart_product_onboarding_api_python_runtime
from amzn_smart_product_onboarding_api_python_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_python_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_python_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_python_runtime.DefaultApi(api_client)
    categorize_product_request_content = amzn_smart_product_onboarding_api_python_runtime.CategorizeProductRequestContent() # CategorizeProductRequestContent |  (optional)

    try:
        api_response = api_instance.categorize_product(categorize_product_request_content=categorize_product_request_content)
        print("The response of DefaultApi->categorize_product:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->categorize_product: %s\n" % e)
```

## Documentation for API Endpoints

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*DefaultApi* | [**categorize_product**](docs/DefaultApi.md#categorize_product) | **POST** /categorizeProduct | 
*DefaultApi* | [**create_batch_execution**](docs/DefaultApi.md#create_batch_execution) | **POST** /createBatchExecution | 
*DefaultApi* | [**download_file**](docs/DefaultApi.md#download_file) | **POST** /downloadFile | 
*DefaultApi* | [**extract_attributes**](docs/DefaultApi.md#extract_attributes) | **POST** /extractAttributes | 
*DefaultApi* | [**generate_product**](docs/DefaultApi.md#generate_product) | **POST** /generateProduct | 
*DefaultApi* | [**get_batch_execution**](docs/DefaultApi.md#get_batch_execution) | **GET** /getBatchExecution/{executionId} | 
*DefaultApi* | [**list_batch_executions**](docs/DefaultApi.md#list_batch_executions) | **GET** /listBatchExecutions | 
*DefaultApi* | [**metaclass**](docs/DefaultApi.md#metaclass) | **POST** /metaclass | 
*DefaultApi* | [**upload_file**](docs/DefaultApi.md#upload_file) | **POST** /uploadFile | 

## Documentation For Models

 - [BadRequestErrorResponseContent](docs/BadRequestErrorResponseContent.md)
 - [BatchExecution](docs/BatchExecution.md)
 - [BatchExecutionStatus](docs/BatchExecutionStatus.md)
 - [CategorizeProductRequestContent](docs/CategorizeProductRequestContent.md)
 - [CategorizeProductResponseContent](docs/CategorizeProductResponseContent.md)
 - [CreateBatchExecutionRequestContent](docs/CreateBatchExecutionRequestContent.md)
 - [DownloadFileRequestContent](docs/DownloadFileRequestContent.md)
 - [ExtractAttributesRequestContent](docs/ExtractAttributesRequestContent.md)
 - [ExtractAttributesResponseContent](docs/ExtractAttributesResponseContent.md)
 - [GenProductRequestContent](docs/GenProductRequestContent.md)
 - [GenProductRequestContentDescriptionLengthEnum](docs/GenProductRequestContentDescriptionLengthEnum.md)
 - [GenProductRequestContentModelEnum](docs/GenProductRequestContentModelEnum.md)
 - [GenProductResponseContent](docs/GenProductResponseContent.md)
 - [InternalFailureErrorResponseContent](docs/InternalFailureErrorResponseContent.md)
 - [ListBatchExecutionsResponseContent](docs/ListBatchExecutionsResponseContent.md)
 - [MetaclassRequestContent](docs/MetaclassRequestContent.md)
 - [MetaclassResponseContent](docs/MetaclassResponseContent.md)
 - [ModelUsage](docs/ModelUsage.md)
 - [NotAuthorizedErrorResponseContent](docs/NotAuthorizedErrorResponseContent.md)
 - [PresignedUrlResponse](docs/PresignedUrlResponse.md)
 - [ProductAttribute](docs/ProductAttribute.md)
 - [ProductData](docs/ProductData.md)
 - [StartBatchExecutionResponseContent](docs/StartBatchExecutionResponseContent.md)
 - [UploadFileRequestContent](docs/UploadFileRequestContent.md)
 - [WordFinding](docs/WordFinding.md)
