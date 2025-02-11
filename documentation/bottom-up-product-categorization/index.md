# Bottom-Up Product Categorization

## Overview

In the world of e-commerce, organizing products into the right categories is crucial for helping customers find what they're looking for quickly and easily. However, with millions of products and thousands of categories, manual categorization is time-consuming, inconsistent, and prone to errors. The Bottom-Up Product Categorization component addresses this challenge by automatically assigning products to the most appropriate category in a large, hierarchical category tree.

This solution leverages artificial intelligence to mimic the way a human expert would categorize products, first identifying the core concept of the product and then determining its specific category. By doing so, it significantly reduces the time and effort required in the product onboarding process, improves catalog consistency, and enhances the overall shopping experience for customers.

## What it Does

The Bottom-Up Product Categorization component takes a product's title and description as input and produces a predicted category ID from the existing category tree, the full path of the predicted category (e.g., "Electronics > Computers > Laptops"), and an explanation for why this category was chosen. The categorization process is designed to work with complex, multi-level category trees containing thousands of possible categories. It can handle a wide range of products, from common items with straightforward descriptions to niche products that require more nuanced understanding.

## How it Works

The categorization process occurs in three main stages. First, the system rephrases the product title using a large language model(LLM) and analyzes it to identify key words or concepts (called "metaclasses") that give a broad indication of what the product is. This step quickly narrows down the possible categories from thousands to a more manageable number. Next, using the identified metaclasses, along with the full product title and description, the system employs an LLM to predict the most appropriate specific category. The LLM is given a carefully crafted prompt that includes the possible categories and instructions on how to make the selection. Finally, the system validates the LLM's prediction to ensure it's a valid category, and then outputs the result along with an explanation.

This process can be used in two ways: for batch processing of multiple products using AWS Step Functions, or for individual product categorization through an API. In the batch process, AWS Lambda functions handle each stage, processing multiple products simultaneously for efficiency. The API allows for real-time categorization of single products, which is useful for integration with other systems or for immediate categorization needs.

## Detailed Documentation

For a more in-depth look at each component of the Bottom-Up Product Categorization system, please refer to the following documents:

- [Category Tree Preparation](category-tree-preparation.md): Learn about the process of preparing and optimizing the category tree for use in our system.
- [Metaclass Task](metaclass-task.md): Dive into the details of how we identify metaclasses from product titles.
- [Categorization Task](categorization-task.md): Explore the final step where we use AI to determine the most appropriate category for each product.

## Why We Designed it This Way

We chose a bottom-up approach, starting with specific concepts (metaclasses) and moving to broader categories, to mimic how human experts often categorize products. This approach helps avoid the cascading errors that can occur in top-down methods where a mistake at a high level leads to completely wrong categorizations. By quickly identifying key concepts from the product title, we dramatically reduce the number of potential categories the AI needs to consider. This not only improves accuracy but also reduces processing time and cost.

We leverage Amazon Bedrock with the Claude 3 Haiku model for the final categorization decision. LLMs excel at understanding context and nuance, allowing for more accurate categorization of complex or ambiguous products. We put significant effort into crafting the prompt for the LLM. This prompt includes specific instructions, examples, and the list of potential categories, guiding the model to make informed decisions much like a human expert would.

Our solution uses a serverless architecture with AWS Lambda and Step Functions, allowing it to scale seamlessly to handle varying loads, from processing a few new products to recategorizing an entire catalog. The addition of an API for individual product categorization provides flexibility for different use cases and integration scenarios. The system is also designed to be adaptable, capable of working with different category trees and adjustable for different languages or specific business needs by modifying the configuration and prompt engineering.

By combining efficient preprocessing, AI-powered decision-making, and a flexible, scalable architecture, this Bottom-Up Product Categorization component provides a powerful tool for e-commerce businesses to maintain large, well-organized product catalogs. It significantly reduces the manual effort required in product categorization while improving consistency and accuracy across the catalog, whether processing products in bulk or one at a time.
