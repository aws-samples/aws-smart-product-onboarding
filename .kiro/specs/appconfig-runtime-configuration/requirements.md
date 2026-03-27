# Requirements Document

## Introduction

This feature introduces AWS AppConfig as a centralized runtime configuration service for the Smart Product Onboarding solution. Currently, AI model IDs and temperature settings are hardcoded in CDK infrastructure code and passed as static environment variables to Lambda functions. This feature enables operators to change model IDs and temperatures at runtime without redeploying infrastructure, using AWS AppConfig's managed configuration with validation, gradual rollout, and instant rollback capabilities.

## Glossary

- **AppConfig_Application**: The AWS AppConfig application resource that groups all configuration profiles for the Smart Product Onboarding solution
- **AppConfig_Environment**: The AWS AppConfig environment resource representing the deployment target (e.g., production) for configuration profiles
- **Configuration_Profile**: An AWS AppConfig configuration profile containing a JSON document with model IDs and temperature settings for all components
- **Deployment_Strategy**: The AWS AppConfig deployment strategy that defines how configuration changes are rolled out (e.g., instantly or gradually)
- **Configuration_Document**: The JSON document stored in AppConfig containing model and temperature settings for each component
- **Product_Generation_Component**: The TypeScript Lambda functions (API and Step Functions) that generate product titles and descriptions from images using Amazon Bedrock, sharing a single configuration entry
- **Metaclass_Classification_Component**: The Python Lambda function that normalizes product titles and classifies products into metaclasses using Amazon Bedrock (currently uses `us.amazon.nova-micro-v1:0`)
- **Product_Categorization_Component**: The Python Lambda function that classifies products into specific categories using Amazon Bedrock (currently uses `us.anthropic.claude-3-haiku-20240307-v1:0`)
- **Attribute_Extraction_Component**: The Python Lambda function that extracts product attributes using Amazon Bedrock (currently uses `us.amazon.nova-premier-v1:0`)
- **Configuration_Client**: A module in each Lambda function responsible for fetching and caching configuration from AWS AppConfig
- **CDK_Infrastructure**: The AWS CDK code in `packages/infra/src/` that defines all cloud resources

## Requirements

### Requirement 1: AppConfig Infrastructure Provisioning

**User Story:** As a platform operator, I want AppConfig resources provisioned as part of the CDK stack, so that runtime configuration is available for all components.

#### Acceptance Criteria

1. THE CDK_Infrastructure SHALL create one AppConfig_Application resource for the Smart Product Onboarding solution
2. THE CDK_Infrastructure SHALL create one AppConfig_Environment resource within the AppConfig_Application
3. THE CDK_Infrastructure SHALL create one Configuration_Profile for AI model settings within the AppConfig_Application
4. THE CDK_Infrastructure SHALL create one Deployment_Strategy resource with an instant deployment type (0-minute bake time, 100% growth)
5. THE CDK_Infrastructure SHALL grant each Lambda function IAM permissions to read from the AppConfig configuration using `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration` actions

### Requirement 2: Configuration Document Schema

**User Story:** As a platform operator, I want a well-defined configuration schema, so that I can safely modify model settings without breaking the system.

#### Acceptance Criteria

1. THE Configuration_Document SHALL contain a top-level key for each component: `productGeneration`, `metaclassClassification`, `productCategorization`, and `attributeExtraction`
2. THE Configuration_Document SHALL store a `modelId` string field for each component
3. THE Configuration_Document SHALL store a `temperature` numeric field for each component
4. THE Configuration_Document SHALL use the following default values matching current infrastructure settings:
   - `productGeneration`: modelId `us.amazon.nova-lite-v1:0`, temperature `0.1`
   - `metaclassClassification`: modelId `us.amazon.nova-micro-v1:0`, temperature `0` (no temperature currently configured)
   - `productCategorization`: modelId `us.anthropic.claude-3-haiku-20240307-v1:0`, temperature `0`
   - `attributeExtraction`: modelId `us.amazon.nova-premier-v1:0`, temperature `0`
5. THE Configuration_Profile SHALL include a JSON Schema validator that validates the Configuration_Document structure before deployment

### Requirement 3: Configuration Retrieval in TypeScript Lambda Functions

**User Story:** As a developer, I want TypeScript Lambda handlers to fetch model configuration from AppConfig at runtime, so that model changes take effect without redeployment.

#### Acceptance Criteria

1. WHEN the Product_Generation_Component Lambda starts a new invocation, THE Configuration_Client SHALL retrieve the latest configuration from AppConfig
2. THE Configuration_Client SHALL cache the retrieved configuration using the AWS AppConfig Data client's built-in polling mechanism to minimize API calls
3. WHEN the Configuration_Client retrieves a configuration, THE Product_Generation_Component SHALL use the `modelId` and `temperature` values from the configuration instead of environment variables
4. IF the Configuration_Client fails to retrieve configuration from AppConfig, THEN THE Product_Generation_Component SHALL fall back to the model ID from the `BEDROCK_MODEL_ID` environment variable and the default temperature value
5. THE CDK_Infrastructure SHALL pass the AppConfig application ID, environment ID, and configuration profile ID as environment variables to each TypeScript Lambda function

### Requirement 4: Configuration Retrieval in Python Lambda Functions

**User Story:** As a developer, I want Python Lambda handlers to fetch model configuration from AppConfig at runtime, so that model changes take effect without redeployment.

#### Acceptance Criteria

1. WHEN the Metaclass_Classification_Component Lambda starts a new invocation, THE Configuration_Client SHALL retrieve the latest configuration from AppConfig
2. WHEN the Product_Categorization_Component Lambda starts a new invocation, THE Configuration_Client SHALL retrieve the latest configuration from AppConfig
3. WHEN the Attribute_Extraction_Component Lambda starts a new invocation, THE Configuration_Client SHALL retrieve the latest configuration from AppConfig
4. THE Configuration_Client SHALL cache the retrieved configuration using the AWS AppConfig Data client's built-in polling mechanism to minimize API calls
5. WHEN the Configuration_Client retrieves a configuration, THE Python Lambda functions SHALL use the `modelId` and `temperature` values from the retrieved configuration instead of environment variables
6. IF the Configuration_Client fails to retrieve configuration from AppConfig, THEN THE Python Lambda functions SHALL fall back to the model ID from the `BEDROCK_MODEL_ID` environment variable and the existing default temperature values
7. THE CDK_Infrastructure SHALL pass the AppConfig application ID, environment ID, and configuration profile ID as environment variables to each Python Lambda function

### Requirement 5: Temperature Configuration for Components Without Existing Temperature Settings

**User Story:** As a platform operator, I want to configure temperature for all AI components, so that I have full control over model behavior across the entire pipeline.

#### Acceptance Criteria

1. WHEN the Metaclass_Classification_Component receives a temperature value from the Configuration_Document, THE Metaclass_Classification_Component SHALL pass the temperature to the Bedrock `get_model_response` call
2. WHEN the Product_Categorization_Component receives a temperature value from the Configuration_Document, THE Product_Categorization_Component SHALL use the temperature in the Bedrock `converse` call instead of the hardcoded value of `0`
3. WHEN the Attribute_Extraction_Component receives a temperature value from the Configuration_Document, THE Attribute_Extraction_Component SHALL use the temperature in the Bedrock `converse` call instead of the hardcoded value of `0`

### Requirement 6: Backward Compatibility with Existing Configuration

**User Story:** As a developer, I want the AppConfig integration to coexist with the existing SSM Parameter Store configuration for the Product Generation component, so that existing functionality is preserved.

#### Acceptance Criteria

1. THE Product_Generation_Component SHALL continue to read language, description length, and examples configuration from the existing SSM Parameter Store parameter (CONFIG_PARAM_NAME)
2. WHEN both AppConfig and SSM Parameter Store provide a model ID or temperature, THE Product_Generation_Component SHALL use the AppConfig values for model ID and temperature
3. THE existing SSM Parameter Store configuration mechanism for categorization config paths (CONFIG_PATHS_PARAM) SHALL remain unchanged for the Metaclass_Classification_Component and Product_Categorization_Component
