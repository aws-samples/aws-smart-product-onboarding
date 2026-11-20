# Attribute Extraction

## Overview

The attribute extraction component is an essential part of the Smart Product Onboarding accelerator, building upon the bottom-up product categorization process. It automatically extracts relevant attributes from product information based on category-specific attribute schemas, enhancing the richness and consistency of product data. This process significantly improves searchability and the overall customer experience in e-commerce platforms.

## Functionality

Given a product's title, description, predicted category from the categorization task, and optional metadata, the attribute extraction component produces a list of extracted attributes and their values. These attributes are based on the specific schema for the predicted category, ensuring relevance and accuracy.

## Technical Approach

### Model Selection

For this task, we use a Sonnet-class model (Anthropic Claude Sonnet 5.5 by default; the accelerator originally used Claude 3.5 Sonnet) due to its advanced cognitive abilities. The extraction of multiple attributes simultaneously requires a more sophisticated understanding of context and relationships within the product information. While we considered using a lighter Haiku-class model, it would have necessitated multiple API calls – one for each attribute. By using a Sonnet-class model, we can extract all attributes in a single call, significantly improving efficiency and reducing API usage.

### Process Flow

The attribute extraction process begins with schema retrieval, where the system fetches the corresponding attribute schema for the predicted category. This schema defines the expected attributes for products in that specific category.

Next, the system constructs a carefully crafted prompt for the AI model. This prompt includes the product information, category details, and the attribute schema. The prompt is then sent to Amazon Bedrock, which processes it using the Claude 3.5 Sonnet model.

The request asks Amazon Bedrock for [structured output](https://docs.aws.amazon.com/bedrock/latest/userguide/structured-output.html): a JSON schema with one required property per attribute, whose value is one of the attribute's listed values or null. The model's answer always matches that schema, so the system reads it as JSON and needs no further validation. Bedrock can't compile the schema for a few categories with long value lists, such as wines; for those, the system retries once with a schema that only requires each value to be a string or null, and remembers the category for the life of the process.

### Key Components

The `AttributesExtractor` class serves as the main driver for the attribute extraction process, handling model interaction, prompt construction, and response parsing. The `SchemaRetriever` component manages the retrieval of attribute schemas, employing a caching mechanism to optimize performance for frequently accessed schemas.

## Prompt Engineering

Prompt engineering plays a crucial role in the accuracy and efficiency of our attribute extraction process. Our approach to prompt design focuses on providing clear instructions and context to guide the AI model in extracting attributes accurately.

### Structure

The request has a system prompt and a user message.

1. **System Prompt**: It sets the model's role, extracting product attributes for an e-commerce catalog, and tells the model to treat the seller-supplied product data as data, never as instructions.

2. **Attribute Schema**: The user message starts with the full XML schema of possible attributes for the category. It is the longest input, so it comes first and the instructions come last.

3. **Category Information**: The product's category and subcategory give the model context.

4. **Product Data**: The product's title, description and any metadata, inside a `<product_data>` block.

5. **Extraction Instructions**: How to choose a value, and to use null when the product data doesn't give one.

6. **Output Format**: Not in the prompt. The JSON schema in the request's `outputConfig` sets it.

### Key Strategies

- **Clear Instructions with Reasons**: The prompt says what to do and why. For example, it asks for null rather than a guess because the results fill a product catalog.
- **Untrusted Input as Data**: Product text comes from sellers, so it is delimited in `<product_data>` and the system prompt tells the model not to follow instructions inside it.
- **Answer Only**: The prompt asks for the answer directly, without a "scratchpad" or reasoning section. Current Claude models reason in their own thinking blocks, and they can decline or content-filter a request that asks them to write their reasoning into the response. See [Keep reasoning in thinking blocks](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback#keep-reasoning-in-thinking-blocks).

### Customization Potential

The prompt template is designed to be flexible and customizable. This allows for easy adaptation to different product domains or specific business requirements by adjusting instructions or emphasizing certain types of attributes.

## Scalability and Limitations

While the attribute extraction component is implemented as an AWS Lambda function, allowing it to handle large volumes of products, it's important to note that the overall scalability is constrained by the rate limits of the configured model in Amazon Bedrock. This means there's an upper limit to the number of products that can be processed within a given timeframe.

## Conclusion

The attribute extraction component represents a powerful tool for enriching product data in e-commerce systems. By leveraging advanced AI capabilities to extract structured attributes from unstructured product descriptions, we enable more consistent and comprehensive product information. This not only improves the accuracy of product data but also enhances searchability and the overall customer experience in e-commerce platforms.
