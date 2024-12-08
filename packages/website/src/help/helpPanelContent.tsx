/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { HelpPanel } from "@cloudscape-design/components";
import { ReactNode } from "react";

type HelpPanelContent = {
  [key: string]: ReactNode;
};

const helpPanelContent: HelpPanelContent = {
  default: (
    <HelpPanel>
      <div>
        <p>There is no additional help content on this page.</p>
      </div>
    </HelpPanel>
  ),

  // Batch Product Onboarding
  "batch-onboarding:overview": (
    <HelpPanel header={<h2>Batch Product Onboarding</h2>}>
      <div>
        <p>
          The Batch Product Onboarding feature allows you to process multiple
          products at once, streamlining your product catalog management.
        </p>
        <h3>Key Features</h3>
        <ul>
          <li>Upload product data via CSV file</li>
          <li>Process multiple products simultaneously</li>
          <li>Monitor batch job status</li>
          <li>Download results for completed batches</li>
        </ul>
        <p>
          To start a new batch, click the "New Onboarding" button and follow the
          prompts to upload your product data.
        </p>
        <h3>Status</h3>
        <p>The status column indicates the current state of your batch job:</p>
        <ul>
          <li>
            <strong>Queued</strong>: Job is waiting to be processed
          </li>
          <li>
            <strong>Running</strong>: Job is currently being processed
          </li>
          <li>
            <strong>Completed</strong>: Job has finished successfully
          </li>
          <li>
            <strong>Error</strong>: Job encountered an error during processing
          </li>
        </ul>
        <p>
          Click on the download icon next to completed jobs to retrieve the
          results.
        </p>
      </div>
    </HelpPanel>
  ),
  "create-batch:products-csv": (
    <HelpPanel header={<h2>Upload Your Product Catalog</h2>}>
      <div>
        <p>
          Upload a CSV file containing your product information. Our system
          will:
        </p>
        <ul>
          <li>Generate titles and descriptions (if not provided)</li>
          <li>Automatically categorize products</li>
          <li>Identify relevant product attributes</li>
        </ul>

        <h3>CSV Format</h3>
        <p>
          Your CSV file should contain the following columns. Any additional
          columns will be ignored.
        </p>

        <h4>Required Fields (one of these combinations)</h4>
        <ul>
          <li>
            Option 1: <code>images</code> column
          </li>
          <li>
            Option 2: both <code>title</code> AND <code>description</code>{" "}
            columns
          </li>
        </ul>

        <h4>Column Descriptions</h4>
        <ul>
          <li>
            <code>title</code>
            <p>The product title. Required if images are not provided.</p>
          </li>
          <li>
            <code>description</code>
            <p>
              Detailed product description. Required if images are not provided.
            </p>
          </li>
          <li>
            <code>images</code>
            <p>
              List of image filenames from your Product Images zip file.
              Required if title and description are not provided.
            </p>
            <p>
              Format: <code>"['image1.jpg', 'image2.jpg']"</code>
            </p>
          </li>
          <li>
            <code>short_description</code>
            <p>Optional. A brief, one-sentence summary of the product.</p>
          </li>
          <li>
            <code>metadata</code>
            <p>
              Optional. Additional product information used to enhance generated
              titles and descriptions.
            </p>
          </li>
        </ul>

        <h3>Tips</h3>
        <ul>
          <li>
            Image filenames must match exactly with those in your zip file
          </li>
          <li>
            To regenerate existing product content, move current
            title/description to the metadata column and provide only the images
            column
          </li>
        </ul>

        <h3>Example CSV Rows</h3>

        <h4>Example 1: Manual content (using title and description)</h4>
        <pre>{`title,short_description,description
"Vintage Leather Bag","Handcrafted messenger bag","This authentic leather messenger bag features premium craftsmanship with hand-stitched details. The bag includes an adjustable shoulder strap, brass hardware, and multiple interior compartments. Perfect for daily use or business travel."`}</pre>

        <h4>Example 2: Auto-generated content (using images and metadata)</h4>
        <pre>{`images,metadata
"['bag-front.jpg','bag-side.jpg','bag-interior.jpg']","Material: genuine leather
Color: brown
Style: vintage
Origin: Italian craftsmanship
Dimensions: 15x11x4 inches"`}</pre>
      </div>
    </HelpPanel>
  ),
  "create-batch:images-zip": (
    <HelpPanel header={<h2>Upload Your Product Images</h2>}>
      <div>
        <p>
          Upload a zip file containing all product images referenced in your CSV
          file.
        </p>
        <h3>Image Requirements</h3>
        <ul>
          <li>Supported formats: GIF, JPEG, PNG, WEBP</li>
          <li>
            Maximum dimensions: 1536 pixels on longest side (larger images will
            be scaled down)
          </li>
          <li>Recommended dimensions: 1092 x 1092 pixels</li>
          <li>Maximum images per product: 20</li>
        </ul>
        <h3>File Organization</h3>
        <ul>
          <li>
            Image filenames in the CSV must match the full path within the zip
            file
          </li>
          <li>Images can be organized in folders</li>
          <li>Each image filename should be unique across all products</li>
        </ul>
        <h3>Example Structure</h3>
        <pre>{`products.zip
├── bags/
│   ├── leather-messenger/
│   │   ├── front.jpg
│   │   ├── side.jpg
│   │   └── interior.jpg
│   └── tote/
│       ├── main.jpg
│       └── detail.webp
└── wallets/
    ├── brown.png
    └── detail.webp`}</pre>
        <p>Corresponding CSV entries would look like:</p>
        <pre>{`images
"['bags/leather-messenger/front.jpg','bags/leather-messenger/side.jpg']"
"['wallets/brown.png','wallets/detail.webp']"`}</pre>

        <h3>Tips</h3>
        <ul>
          <li>Use descriptive filenames to easily identify your images</li>
          <li>Ensure images are high quality but within the size limits</li>
          <li>Organize folders by product type for easier management</li>
        </ul>
      </div>
    </HelpPanel>
  ),

  // Smart Product Onboarding
  "smart-onboarding:overview": (
    <HelpPanel header={<h2>Smart Product Onboarding</h2>}>
      <div>
        <p>
          Smart Product Onboarding guides you through the process of creating a
          new product listing using AI-powered content generation and
          categorization.
        </p>
        <h3>Process Steps</h3>
        <ol>
          <li>Enter product images and metadata</li>
          <li>Configure generation options</li>
          <li>Provide example products (optional)</li>
          <li>Review generated content</li>
          <li>Review classification and attributes</li>
          <li>Final review</li>
        </ol>
        <p>
          Follow the wizard steps to create a comprehensive and accurately
          categorized product listing.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:product-input": (
    <HelpPanel header={<h2>Product Input</h2>}>
      <div>
        <h3>Image Upload</h3>
        <p>
          Upload up to 20 images of your product. Supported formats include JPG,
          PNG, GIF, and WebP.
        </p>
        <h3>Product Metadata</h3>
        <p>
          Enter any additional information about the product that may help in
          generating accurate titles and descriptions. This could include
          details like materials, dimensions, or special features.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:generation-options": (
    <HelpPanel header={<h2>Generation Options</h2>}>
      <div>
        <h3>Language</h3>
        <p>
          Specify the language for the generated content. Default is English.
        </p>
        <h3>Description Length</h3>
        <p>Choose between short, medium, or long product descriptions.</p>
        <h3>AI Model</h3>
        <p>
          Select the AI model to use for content generation. Different models
          may have varying capabilities and performance.
        </p>
        <h3>Temperature</h3>
        <p>
          Adjust the creativity of the AI. Lower values produce more consistent
          results, while higher values increase variability.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:example-products": (
    <HelpPanel header={<h2>Example Products</h2>}>
      <div>
        <p>
          Provide examples of well-written product titles and descriptions to
          guide the AI in generating content for your new product.
        </p>
        <p>
          This step is optional but can be helpful in maintaining a consistent
          style and tone across your product catalog.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:review-content": (
    <HelpPanel header={<h2>Review Generated Content</h2>}>
      <div>
        <p>
          Review the AI-generated title and description for your product. You
          can edit this content if needed.
        </p>
        <p>
          If you're not satisfied with the generated content, you can click
          "Regenerate" to create a new version.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:review-classification": (
    <HelpPanel header={<h2>Review Classification and Attributes</h2>}>
      <div>
        <p>
          Review the automatically determined product category and extracted
          attributes.
        </p>
        <p>
          If the classification seems incorrect, you can click "Regenerate" to
          attempt a new classification.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:extract-attributes": (
    <HelpPanel header={<h2>Extract Attributes</h2>}>
      <div>
        <p>
          Review the attributes automatically extracted from your product data.
          These are the attributes designated for the category.
        </p>
        <p>
          If the attributes seem incorrect, you can click "Regenerate" to
          attempt a new extraction.
        </p>
      </div>
    </HelpPanel>
  ),
  "smart-onboarding:final-review": (
    <HelpPanel header={<h2>Final Review</h2>}>
      <div>
        <p>
          Here you can review all the information before you would submit the
          product. In the demo, this does nothing, but you can adapt it to add
          the product to your catalog.
        </p>
        <p>
          Ensure that the title, description, category, and attributes are all
          correct and appropriate for your product.
        </p>
      </div>
    </HelpPanel>
  ),
};

export default helpPanelContent;
