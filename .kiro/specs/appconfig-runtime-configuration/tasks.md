# Implementation Plan: AppConfig Runtime Configuration

## Overview

Implement AWS AppConfig as the runtime configuration source for AI model settings (modelId, temperature) across all Smart Product Onboarding Lambda components. The implementation proceeds bottom-up: CDK construct first, then configuration clients (TypeScript and Python), then handler integration, and finally wiring everything together in the application stack.

## Tasks

- [x] 1. Create the AppConfig CDK construct
  - [x] 1.1 Create `packages/infra/src/constructs/appconfig/appconfig.ts` with `AppConfigConstruct`
    - Create `CfnApplication`, `CfnEnvironment`, `CfnConfigurationProfile` (with JSON Schema validator), and `CfnDeploymentStrategy` (instant: 0 min bake, 100% growth)
    - Expose `applicationId`, `environmentId`, `configurationProfileId` as public properties
    - Implement `grantRead(grantee: iam.IGrantable)` that adds IAM policy for `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`
    - Embed the JSON Schema from the design document as the configuration profile validator
    - Do NOT deploy an initial configuration document
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.2 Write CDK assertion tests for `AppConfigConstruct`
    - Use `Template.fromStack` to verify synthesized CloudFormation contains AppConfig application, environment, configuration profile, deployment strategy
    - Verify JSON Schema validator is attached to the configuration profile
    - Verify `grantRead` produces correct IAM policy statements
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.3 Write property test for configuration document schema validity (TypeScript/fast-check)
    - **Property 1: Configuration document structure validity**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ]* 1.4 Write property test for JSON Schema rejection of invalid documents (TypeScript/fast-check)
    - **Property 2: JSON Schema rejects invalid configuration documents**
    - **Validates: Requirements 2.5**

- [x] 3. Implement the TypeScript AppConfig configuration client
  - [x] 3.1 Create `packages/api/handlers/typescript/src/services/appConfigClient.ts`
    - Implement `AppConfigClient` class using `@aws-sdk/client-appconfigdata` (`StartConfigurationSession`, `GetLatestConfiguration`)
    - Maintain session token across invocations for polling
    - Parse JSON response body and return `AppConfigSettings` (`modelId`, `temperature`) for a given component key
    - Return `null` on any error (network, parse, missing key, empty body when no config deployed)
    - Never throw exceptions — all errors caught internally and logged
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 3.2 Write unit tests for the TypeScript AppConfig client
    - Mock `@aws-sdk/client-appconfigdata` to test: successful retrieval, session token reuse, empty body (no config deployed), network error, malformed JSON, missing component key
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 3.3 Write property test for handlers using AppConfig values when available (TypeScript/fast-check)
    - **Property 3: Handlers use AppConfig values when available**
    - **Validates: Requirements 3.3, 4.5**

  - [x] 3.4 Write property test for handlers falling back to defaults on AppConfig failure (TypeScript/fast-check)
    - **Property 4: Handlers fall back to defaults on AppConfig failure**
    - **Validates: Requirements 3.4, 4.6**

- [x] 4. Implement the Python AppConfig configuration client
  - [x] 4.1 Create `packages/smart-product-onboarding/core-utils/amzn_smart_product_onboarding_core_utils/appconfig_client.py`
    - Implement `AppConfigClient` class using `boto3.client("appconfigdata")` (`start_configuration_session`, `get_latest_configuration`)
    - Maintain session token across invocations for polling
    - Parse JSON response body and return `AppConfigSettings` dataclass (`model_id`, `temperature`) for a given component key
    - Return `None` on any error (network, parse, missing key, empty body when no config deployed)
    - Never raise exceptions — all errors caught internally and logged
    - Add `boto3` dependency to core-utils `pyproject.toml` if not already present
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 4.2 Write unit tests for the Python AppConfig client
    - Mock `boto3` `appconfigdata` client to test: successful retrieval, session token reuse, empty body, network error, malformed JSON, missing component key
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

  - [x] 4.3 Write property test for temperature passthrough to Bedrock API (Python/hypothesis)
    - **Property 5: Temperature from configuration is passed to Bedrock API calls**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 5. Checkpoint - Ensure configuration client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add temperature support to Python components that lack it
  - [x] 6.1 Add optional `temperature` parameter to `get_model_response` in `packages/smart-product-onboarding/core-utils/amzn_smart_product_onboarding_core_utils/boto3_helper/bedrock_runtime_client.py`
    - Add `temperature: float = 0` parameter
    - Use it in the `inferenceConfig` dict instead of the hardcoded `0`
    - _Requirements: 5.1_

  - [x] 6.2 Add `temperature` constructor parameter to `ProductClassifier` in `packages/smart-product-onboarding/product-categorization/amzn_smart_product_onboarding_product_categorization/product_classifier/__init__.py`
    - Add `temperature: float = 0` to `__init__`
    - Use `self.temperature` in `_get_model_response` instead of hardcoded `0`
    - _Requirements: 5.2_

  - [x] 6.3 Add `temperature` constructor parameter to `AttributesExtractor` in `packages/smart-product-onboarding/product-categorization/amzn_smart_product_onboarding_product_categorization/attributes_extractor/__init__.py`
    - Add `temperature: float = 0` to `__init__`
    - Use `self.temperature` in `extract_attributes` instead of hardcoded `0`
    - _Requirements: 5.3_

  - [x] 6.4 Write unit tests verifying temperature is passed through to Bedrock calls
    - Test `get_model_response` with custom temperature
    - Test `ProductClassifier` passes temperature to `converse`
    - Test `AttributesExtractor` passes temperature to `converse`
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Integrate AppConfig into TypeScript Lambda handlers
  - [x] 7.1 Update `packages/api/handlers/typescript/src/generate-product-sfn.ts`
    - Instantiate `AppConfigClient` at module level using `APPCONFIG_APPLICATION_ID`, `APPCONFIG_ENVIRONMENT_ID`, `APPCONFIG_CONFIGURATION_PROFILE_ID` env vars
    - In handler, call `getConfiguration("productGeneration")` and use returned `modelId`/`temperature` if available
    - AppConfig values override SSM's `model` and `temperature` fields; SSM still provides `language`, `descriptionLength`, `examples`
    - Fall back to `BEDROCK_MODEL_ID` env var and default temperature `0.1` on failure
    - _Requirements: 3.1, 3.3, 3.4, 6.1, 6.2_

  - [x] 7.2 Update `packages/api/handlers/typescript/src/generate-product.ts`
    - Instantiate `AppConfigClient` at module level
    - In handler, call `getConfiguration("productGeneration")` and use returned `modelId`/`temperature` as defaults (request body values still take precedence)
    - Fall back to `BEDROCK_MODEL_ID` env var and default temperature `0.1` on failure
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 7.3 Write unit tests for TypeScript handler AppConfig integration
    - Test that handlers use AppConfig values when client returns config
    - Test fallback to env vars when client returns null
    - Test SSM still provides language/descriptionLength/examples for SFN handler
    - _Requirements: 3.3, 3.4, 6.1, 6.2_

  - [x] 7.4 Write property test for AppConfig precedence over SSM (TypeScript/fast-check)
    - **Property 6: AppConfig values take precedence over SSM for model and temperature**
    - **Validates: Requirements 6.2**

- [x] 8. Integrate AppConfig into Python Lambda handlers
  - [x] 8.1 Update `packages/smart-product-onboarding/metaclasses/amzn_smart_product_onboarding_metaclasses/aws_lambda.py`
    - Instantiate `AppConfigClient` at module level using env vars
    - In handler, call `get_configuration("metaclassClassification")` and use `model_id`/`temperature` if available
    - Pass temperature to `MetaclassClassifier` → `get_model_response`
    - Fall back to `BEDROCK_MODEL_ID` env var and temperature `0` on failure
    - _Requirements: 4.1, 4.5, 4.6, 5.1_

  - [x] 8.2 Update `packages/smart-product-onboarding/product-categorization/amzn_smart_product_onboarding_product_categorization/aws_lambda/categorization.py`
    - Instantiate `AppConfigClient` at module level using env vars
    - In handler, call `get_configuration("productCategorization")` and use `model_id`/`temperature` if available
    - Pass temperature to `ProductClassifier` constructor
    - Fall back to `BEDROCK_MODEL_ID` env var and temperature `0` on failure
    - _Requirements: 4.2, 4.5, 4.6, 5.2_

  - [x] 8.3 Update `packages/smart-product-onboarding/product-categorization/amzn_smart_product_onboarding_product_categorization/aws_lambda/attribute_extraction.py`
    - Instantiate `AppConfigClient` at module level using env vars
    - In handler, call `get_configuration("attributeExtraction")` and use `model_id`/`temperature` if available
    - Pass temperature to `AttributesExtractor` constructor
    - Fall back to `BEDROCK_MODEL_ID` env var and temperature `0` on failure
    - _Requirements: 4.3, 4.5, 4.6, 5.3_

  - [x] 8.4 Write unit tests for Python handler AppConfig integration
    - Test each handler uses AppConfig values when client returns config
    - Test fallback to env vars when client returns None
    - _Requirements: 4.5, 4.6_
    
- [x] 10. Wire AppConfig construct into CDK infrastructure and pass env vars to Lambdas
  - [x] 10.1 Instantiate `AppConfigConstruct` in `packages/infra/src/stacks/application-stack.ts`
    - Create the construct and call `grantRead` for each Lambda function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 10.2 Pass AppConfig environment variables to all Lambda constructs
    - Add `APPCONFIG_APPLICATION_ID`, `APPCONFIG_ENVIRONMENT_ID`, `APPCONFIG_CONFIGURATION_PROFILE_ID` to each Lambda function's environment in the CDK constructs: `sfn-generate-product-task`, `sfn-metaclass-task`, `sfn-classification-task`, `sfn-attributes-task`, and the API construct's Lambda functions
    - _Requirements: 3.5, 4.7_

  - [ ]* 10.3 Write CDK assertion tests verifying env vars and IAM permissions are wired
    - Verify Lambda environment variables contain AppConfig IDs
    - Verify IAM policies include `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`
    - _Requirements: 1.5, 3.5, 4.7_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- TypeScript property tests use `fast-check`; Python property tests use `hypothesis`
- CDK only provisions the AppConfig shell — no initial configuration document is deployed
- All handlers gracefully handle empty/missing AppConfig configuration by falling back to environment variable defaults
