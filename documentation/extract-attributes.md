# Attribute Extraction

## Overview

The attribute extraction component is an essential part of the Smart Product Onboarding accelerator, building upon the bottom-up product categorization process. It automatically extracts relevant attributes from product information based on category-specific attribute schemas, enhancing the richness and consistency of product data. This process significantly improves searchability and the overall customer experience in e-commerce platforms.

## Functionality

Given a product's title, description, predicted category from the categorization task, and optional metadata, the attribute extraction component produces a list of extracted attributes and their values. These attributes are based on the specific schema for the predicted category, ensuring relevance and accuracy.

## Technical Approach

### Model Selection

For this task, we specifically chose Claude 3.5 Sonnet due to its advanced cognitive abilities. The extraction of multiple attributes simultaneously requires a more sophisticated understanding of context and relationships within the product information. While we considered using the lighter Claude 3 Haiku model, it would have necessitated multiple API calls – one for each attribute. By leveraging Claude 3.5 Sonnet's capabilities, we can extract all attributes in a single call, significantly improving efficiency and reducing API usage.

### Process Flow

The attribute extraction process begins with schema retrieval, where the system fetches the corresponding attribute schema for the predicted category. This schema defines the expected attributes for products in that specific category.

Next, the system constructs a carefully crafted prompt for the AI model. This prompt includes the product information, category details, and the attribute schema. The prompt is then sent to Amazon Bedrock, which processes it using the Claude 3.5 Sonnet model.

After receiving the model's response in XML format, the system parses it to extract the identified attributes and their values. Finally, a basic validation is performed to ensure the extracted attributes conform to the expected schema.

### Key Components

The `AttributesExtractor` class serves as the main driver for the attribute extraction process, handling model interaction, prompt construction, and response parsing. The `SchemaRetriever` component manages the retrieval of attribute schemas, employing a caching mechanism to optimize performance for frequently accessed schemas.

## Prompt Engineering

Prompt engineering plays a crucial role in the accuracy and efficiency of our attribute extraction process. Our approach to prompt design focuses on providing clear instructions and context to guide the AI model in extracting attributes accurately.

### Structure

The prompt is structured in several key sections:

1. **Task Definition**: We begin by clearly defining the AI's role and the task at hand, setting the context for attribute extraction.

2. **Category Information**: We provide the product's category and subcategory, helping the model understand the context of the product.

3. **Attribute Schema**: We include the full XML schema of possible attributes for the given category. This gives the model a comprehensive list of what to look for.

4. **Product Information**: We provide the product's title, description, and any additional metadata.

5. **Extraction Instructions**: We give step-by-step instructions on how to approach the extraction task, including how to handle missing information or ambiguous cases.

6. **Output Format**: We specify the exact XML format we expect for the output, ensuring consistency in the response structure.

### Key Strategies

Several strategies are employed in our prompt design to enhance extraction accuracy:

- **Explicit Instructions**: We provide clear, step-by-step instructions for the model to follow, reducing ambiguity in the task.
- **Scratchpad Technique**: We instruct the model to use a "scratchpad" to think through its extraction process before providing the final answer. This encourages more thorough analysis.
- **Handling Uncertainty**: We give explicit instructions on how to handle cases where an attribute is not mentioned or its value cannot be determined.
- **Emphasis on Accuracy**: We stress the importance of being as specific and accurate as possible, and not making assumptions.

### Customization Potential

The prompt template is designed to be flexible and customizable. This allows for easy adaptation to different product domains or specific business requirements by adjusting instructions or emphasizing certain types of attributes.

## Scalability and Limitations

While the attribute extraction component is implemented as an AWS Lambda function, allowing it to handle large volumes of products, it's important to note that the overall scalability is constrained by the rate limits of the Claude 3.5 Sonnet model in Amazon Bedrock. This means there's an upper limit to the number of products that can be processed within a given timeframe.

## Conclusion

The attribute extraction component represents a powerful tool for enriching product data in e-commerce systems. By leveraging advanced AI capabilities to extract structured attributes from unstructured product descriptions, we enable more consistent and comprehensive product information. This not only improves the accuracy of product data but also enhances searchability and the overall customer experience in e-commerce platforms.
