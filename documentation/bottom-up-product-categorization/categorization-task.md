## Categorization Task

### Overview

The categorization task is the final step in our bottom-up product categorization process. It leverages the metaclasses identified in the previous step to predict the most appropriate category for a product within a large, hierarchical category tree. This task employs a generative AI model to make nuanced decisions based on the product's title, description, and the identified metaclasses.

### What it Does

The categorization task takes the product title and description, the metaclasses identified in the previous step, and a list of candidate categories based on the metaclasses as input. It then produces a predicted category ID from the existing category tree, the full path of the predicted category (e.g., "Electronics > Computers > Laptops"), and an explanation for why this category was chosen.

### How it Works

The categorization process begins with candidate category selection. Using the metaclasses identified in the previous step, the system generates a list of possible categories. This significantly narrows down the search space from thousands of potential categories to a more manageable number.

Next, the system constructs a prompt for the AI model. This prompt includes the product title and description, the list of candidate categories, specific instructions on how to make the categorization decision, and examples of correct categorizations if available.

The prompt is then sent to Amazon Bedrock, which uses the Claude 3 Haiku model to process it. This model excels at understanding context and nuance, allowing for more accurate categorization of complex or ambiguous products.

After receiving the response from the AI model, the system parses it to extract the predicted category ID, category name, and explanation. Finally, the system validates that the predicted category exists in the category tree and matches the predicted name.

### Key Components

#### ProductClassifier

The main class responsible for the categorization process is the ProductClassifier. It handles the interaction with the AI model, prompt construction, and response parsing.

#### Prompt Engineering

The prompt for the AI model is designed to guide the model to make decisions similar to how a human expert would, considering various aspects of the product and the potential categories.

#### Amazon Bedrock Integration

We use Amazon Bedrock with the Claude 3 Haiku model for the AI-powered decision making. This provides us with state-of-the-art natural language processing capabilities without the need to maintain our own ML infrastructure.

### Why We Designed it This Way

We chose to leverage Generative AI-powered decision making because it allows us to make nuanced categorization decisions that consider context and subtle product details. This approach is more flexible and can handle a wider variety of products compared to rule-based systems. Moreover, it avoids the significant data requirements of traditional ML classification models. We estimated that a traditional approach would require around 100 labeled products per category, which would be a tremendous undertaking for a large category tree. Additionally, as the category tree evolves, a traditional model would require significant effort to retrain, whereas our Generative AI-based approach can adapt more readily to changes.

Our narrow-then-decide approach, where we first narrow down the possible categories using metaclasses before making a final decision among these candidates, balances efficiency with accuracy. This approach allows us to handle large category trees without overwhelming the AI model.

We require the AI model to provide an explanation for its decision to aid in understanding why a particular category was chosen. This can be valuable for auditing or improving the system.

The system is designed to be flexible and can be easily adapted to different category trees or product domains by modifying the prompt and the category selection process.

### Scalability and Limitations

While the categorization task is implemented as an AWS Lambda function, which can scale to handle large volumes of products, it's important to note that the overall scalability is limited by Amazon Bedrock token rate limits. This means that while the system can handle high volumes, there is an upper limit to the number of products that can be processed within a given time frame.

### Configuration and Customization

The categorization task can be customized in several ways. The prompt can be modified to include domain-specific instructions or to emphasize certain aspects of categorization. Including examples of correct categorizations and detailed category descriptions in the prompt can significantly help guide the AI model, especially for complex or ambiguous product types.

While we use Claude 3 Haiku, the system can be adapted to use other models available through Amazon Bedrock. The category validation process can also be customized based on the structure of your specific category tree.

### The Importance of a Good Category Tree

In our research, we found that many retailers primarily use a navigation tree for their product categories. While a navigation tree is beneficial for customers using a top-down approach to find products, it can pose challenges for automatic categorization techniques due to duplicate categories in multiple locations.

For effective automatic categorization, it's better to use a taxonomy where there is exactly one correct category for each product. A navigation tree can be transformed into a taxonomy by pruning duplicate categories. This avoids issues such as classifiers putting all of a kind of product in one location and none in others, or splitting them between locations. To preserve the findability of products, the navigation tree can have mappings to the taxonomy.

Category descriptions play a crucial role in improving the LLM's understanding and accuracy. The GS1 Global Product Classification (GPC) standard, which we use as an example in this accelerator, provides these descriptions. For retailers using their existing category tree, it's worth the effort to write clear, concise descriptions for each category. These descriptions help the AI model better understand the nuances between categories and make more accurate classification decisions.

### Conclusion

The categorization task represents the culmination of our bottom-up product categorization process. By leveraging AI to make informed decisions based on product details and pre-identified metaclasses, we're able to accurately categorize products within complex hierarchical category trees. This approach combines the efficiency of traditional classification methods with the flexibility and nuance of human-like decision making, resulting in a powerful tool for managing large e-commerce catalogs.
