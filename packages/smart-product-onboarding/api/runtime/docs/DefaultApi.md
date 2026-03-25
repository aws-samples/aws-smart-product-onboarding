# amzn_smart_product_onboarding_api_runtime.DefaultApi

Method | HTTP request | Description
------------- | ------------- | -------------
[**categorize_product**](DefaultApi.md#categorize_product) | **POST** /categorizeProduct | 
[**create_batch_execution**](DefaultApi.md#create_batch_execution) | **POST** /createBatchExecution | 
[**download_file**](DefaultApi.md#download_file) | **POST** /downloadFile | 
[**extract_attributes**](DefaultApi.md#extract_attributes) | **POST** /extractAttributes | 
[**generate_product**](DefaultApi.md#generate_product) | **POST** /generateProduct | 
[**get_batch_execution**](DefaultApi.md#get_batch_execution) | **GET** /getBatchExecution/{executionId} | 
[**list_batch_executions**](DefaultApi.md#list_batch_executions) | **GET** /listBatchExecutions | 
[**metaclass**](DefaultApi.md#metaclass) | **POST** /metaclass | 
[**upload_file**](DefaultApi.md#upload_file) | **POST** /uploadFile | 

# **categorize_product**
> CategorizeProductResponseContent categorize_product(categorize_product_request_content=categorize_product_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    categorize_product_request_content = amzn_smart_product_onboarding_api_runtime.CategorizeProductRequestContent() # CategorizeProductRequestContent |  (optional)

    try:
        api_response = api_instance.categorize_product(categorize_product_request_content=categorize_product_request_content)
        print("The response of DefaultApi->categorize_product:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->categorize_product: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **categorize_product_request_content** | [**CategorizeProductRequestContent**](CategorizeProductRequestContent.md) |  | [optional] 

### Return type

[**CategorizeProductResponseContent**](CategorizeProductResponseContent.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_batch_execution**
> StartBatchExecutionResponseContent create_batch_execution(create_batch_execution_request_content=create_batch_execution_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    create_batch_execution_request_content = amzn_smart_product_onboarding_api_runtime.CreateBatchExecutionRequestContent() # CreateBatchExecutionRequestContent |  (optional)

    try:
        api_response = api_instance.create_batch_execution(create_batch_execution_request_content=create_batch_execution_request_content)
        print("The response of DefaultApi->create_batch_execution:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->create_batch_execution: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_batch_execution_request_content** | [**CreateBatchExecutionRequestContent**](CreateBatchExecutionRequestContent.md) |  | [optional] 

### Return type

[**StartBatchExecutionResponseContent**](StartBatchExecutionResponseContent.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **download_file**
> PresignedUrlResponse download_file(download_file_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    download_file_request_content = amzn_smart_product_onboarding_api_runtime.DownloadFileRequestContent() # DownloadFileRequestContent | 

    try:
        api_response = api_instance.download_file(download_file_request_content)
        print("The response of DefaultApi->download_file:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->download_file: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **download_file_request_content** | [**DownloadFileRequestContent**](DownloadFileRequestContent.md) |  | 

### Return type

[**PresignedUrlResponse**](PresignedUrlResponse.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **extract_attributes**
> ExtractAttributesResponseContent extract_attributes(extract_attributes_request_content=extract_attributes_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    extract_attributes_request_content = amzn_smart_product_onboarding_api_runtime.ExtractAttributesRequestContent() # ExtractAttributesRequestContent |  (optional)

    try:
        api_response = api_instance.extract_attributes(extract_attributes_request_content=extract_attributes_request_content)
        print("The response of DefaultApi->extract_attributes:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->extract_attributes: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **extract_attributes_request_content** | [**ExtractAttributesRequestContent**](ExtractAttributesRequestContent.md) |  | [optional] 

### Return type

[**ExtractAttributesResponseContent**](ExtractAttributesResponseContent.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **generate_product**
> GenProductResponseContent generate_product(gen_product_request_content)


Using images in S3 and textual metadata, generate a title and description for the product.


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    gen_product_request_content = amzn_smart_product_onboarding_api_runtime.GenProductRequestContent() # GenProductRequestContent | 

    try:
        # Using images in S3 and textual metadata, generate a title and description for the product.

        api_response = api_instance.generate_product(gen_product_request_content)
        print("The response of DefaultApi->generate_product:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->generate_product: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **gen_product_request_content** | [**GenProductRequestContent**](GenProductRequestContent.md) |  | 

### Return type

[**GenProductResponseContent**](GenProductResponseContent.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_batch_execution**
> BatchExecution get_batch_execution(execution_id)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    execution_id = "dolore suadeo accendo" # str | 

    try:
        api_response = api_instance.get_batch_execution(execution_id)
        print("The response of DefaultApi->get_batch_execution:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->get_batch_execution: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **execution_id** | **str** |  | 

### Return type

[**BatchExecution**](BatchExecution.md)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_batch_executions**
> ListBatchExecutionsResponseContent list_batch_executions(start_time=start_time, end_time=end_time)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    start_time = "vita uxor currus" # str |  (optional)
    end_time = "torqueo desparatus stultus" # str |  (optional)

    try:
        api_response = api_instance.list_batch_executions(start_time=start_time, end_time=end_time)
        print("The response of DefaultApi->list_batch_executions:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->list_batch_executions: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **start_time** | **str** |  | [optional] 
 **end_time** | **str** |  | [optional] 

### Return type

[**ListBatchExecutionsResponseContent**](ListBatchExecutionsResponseContent.md)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **metaclass**
> MetaclassResponseContent metaclass(metaclass_request_content=metaclass_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    metaclass_request_content = amzn_smart_product_onboarding_api_runtime.MetaclassRequestContent() # MetaclassRequestContent |  (optional)

    try:
        api_response = api_instance.metaclass(metaclass_request_content=metaclass_request_content)
        print("The response of DefaultApi->metaclass:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->metaclass: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **metaclass_request_content** | [**MetaclassRequestContent**](MetaclassRequestContent.md) |  | [optional] 

### Return type

[**MetaclassResponseContent**](MetaclassResponseContent.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_file**
> PresignedUrlResponse upload_file(upload_file_request_content)


### Example

```python
import time
import amzn_smart_product_onboarding_api_runtime
from amzn_smart_product_onboarding_api_runtime.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = amzn_smart_product_onboarding_api_runtime.Configuration(
    host = "http://localhost"
)

# Enter a context with an instance of the API client
with amzn_smart_product_onboarding_api_runtime.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = amzn_smart_product_onboarding_api_runtime.DefaultApi(api_client)
    upload_file_request_content = amzn_smart_product_onboarding_api_runtime.UploadFileRequestContent() # UploadFileRequestContent | 

    try:
        api_response = api_instance.upload_file(upload_file_request_content)
        print("The response of DefaultApi->upload_file:\n")
        pprint(api_response)
    except ApiException as e:
        print("Exception when calling DefaultApi->upload_file: %s\n" % e)
```

### Parameters
Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **upload_file_request_content** | [**UploadFileRequestContent**](UploadFileRequestContent.md) |  | 

### Return type

[**PresignedUrlResponse**](PresignedUrlResponse.md)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful response |  -  |
**400** | An error at the fault of the client sending invalid input |  -  |
**403** | An error due to the client not being authorized to access the resource |  -  |
**500** | An internal failure at the fault of the server |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

