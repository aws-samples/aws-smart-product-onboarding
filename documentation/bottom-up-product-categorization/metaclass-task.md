## Metaclass Task

### Overview

The metaclass task is the cornerstone of our bottom-up product categorization process. It's designed to swiftly identify key concepts or words (metaclasses) from a product's title, effectively narrowing down the possible categories for the product. This crucial first step significantly enhances the efficiency and accuracy of the subsequent categorization process.

### What it Does

At its core, the metaclass task takes a product title as input and produces a list of identified metaclasses, a cleaned version of the product title, and detailed findings about the metaclass identification process. This information becomes the foundation for the categorization task to determine the final product category.

### How it Works

The process begins with thorough text cleaning. Our `TextCleaner` class takes the product title through a series of transformations: converting to lowercase, removing special characters and HTML tags, stripping out brand names (if a brand list is provided), eliminating package information and dimensions, replacing acronyms with full words, and singularizing words. This cleaned text then becomes the basis for our metaclass identification.

We employ a two-pronged approach to identify metaclasses. First, we perform exact matching against a pre-generated list of metaclasses. Any exact matches are given the highest score. For words that don't have an exact match, we turn to word embeddings to find similar metaclasses. This approach helps us capture synonyms and related terms, making our system more robust in handling a variety of product titles, including those with typos or unconventional wording.

### Word Embeddings and Language Support

Our decision to use word embeddings instead of sentence embeddings was deliberate. While sentence embeddings can capture context well, they struggle with the short, often fragmented nature of product titles. Word embeddings allow us to evaluate each word independently, which is crucial when dealing with titles that may combine multiple concepts. However, this choice does come with a drawback: it makes our system language-dependent. The word embeddings and category tree need to be in the same language as the product titles being processed.

For customers looking to adapt this system to their preferred language, they would need to provide word embeddings and a category tree in their target language. Fortunately, there are excellent resources available for both:

1. Word embeddings for many languages can be found in [FastText](https://fasttext.cc/docs/en/crawl-vectors.html). These pre-trained word vectors are available for 157 languages and are based on Common Crawl and Wikipedia data.

2. For the category tree, this accelerator uses the GS1 Global Product Categorization (GPC) as an example. GS1 provides translations of their category tree in many languages, which can be accessed through the [GPC Browser](https://gpc-browser.gs1.org/). This resource allows customers to adapt the categorization system to their specific language and market needs.

Using these resources, customers can relatively easily adapt the system to their preferred language without having to create word embeddings or translate category trees from scratch.

### Key Components

The heart of our metaclass identification lies in the `MetaclassClassifier` class. It orchestrates the matching, scoring, and selection processes. Each potential metaclass is scored based on its match type (exact or embedding) and its position in the title, with earlier words given higher scores as they're often more relevant to the product's core concept. The top-scoring metaclasses are then selected, with the possibility of combining multiple high-scoring metaclasses to form compound metaclasses.

### Technical Implementation

It's worth noting that the Lambda function for this task is particularly resource-intensive. We've configured it with 1792MB of memory to provide sufficient processing power. The function uses Gensim's KeyedVectors to perform vector searches, which are exhaustive in nature. For each word evaluated in the title, we calculate the cosine distance against each word in our list of words present in the category tree. While this might sound computationally expensive, in practice, it's quite fast because we're dealing with a relatively small vocabulary - only thousands of words.

### Why We Designed it This Way

We designed the metaclass task with several key considerations in mind. Efficiency was paramount - by quickly narrowing down possible categories, we significantly reduce the workload on the more computationally intensive categorization step. We also prioritized robustness and flexibility. The combination of exact matching and word embeddings allows our system to handle a wide variety of product titles, and the system can be easily adapted to different languages or product domains by modifying the metaclass list, word embeddings, and cleaning processes.

Transparency was another crucial factor. The detailed findings provided by this task help in understanding and debugging the categorization process. And despite its resource-intensive nature, we've ensured scalability by implementing the metaclass task as an AWS Lambda function, providing automatic scaling to handle large numbers of products quickly.

One drawback of the metaclass approach is that it doesn't work effectively for products that use the name of the work as the title, such as books, movies, or music albums. These titles often don't contain descriptive words that can be matched to metaclasses. Fortunately, there are few enough of these categories that we can always include all of them in the subsequent categorization task. This ensures that these types of products can still be accurately categorized despite the limitations of the metaclass identification process.


### Configuration and Customization

The metaclass task is highly customizable. Customers can update the metaclass list to reflect the specific vocabulary of their product catalog, provide a list of brand names to improve the cleaning process, use different pre-trained embeddings for different languages or domains, modify the `TextCleaner` to add or remove cleaning steps as needed, and adjust the scoring system to give more or less weight to different types of matches or word positions.

In essence, the metaclass task is a powerful, flexible tool that forms the foundation of our bottom-up categorization process. By identifying key concepts quickly and accurately, it sets the stage for precise product categorization, ultimately contributing to a more organized and easily navigable product catalog. With the availability of pre-trained word embeddings and translated category trees, this system can be adapted to various languages and markets, making it a versatile solution for global e-commerce businesses.
