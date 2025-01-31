/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { SpaceBetween } from "@cloudscape-design/components";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import LLMOptionsForm from "../../components/GenerationOptions/LLMOptionsForm";
import Examples from "../../components/GenProductData/Examples";
import ImageUploader from "../../components/GenProductData/ImageUploader";
import ProductMetadata from "../../components/GenProductData/ProductMetadata";
import ReviewProductDataStep from "../../components/SmartProductOnboarding/Steps/ReviewProductDataStep";
import { useProductGeneration } from "../../hooks/useProductGeneration";

const GenProductDataDemo = () => {
  const {
    imageFiles,
    setImageFiles,
    productMetadata,
    setProductMetadata,
    examples,
    setExamples,
    llmOptions,
    setLLMOptions,
    status,
    generateProduct,
    handleReset,
    generateProductData,
  } = useProductGeneration();

  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            description="Test the product data generation functionality"
            actions={<Button onClick={handleReset}>New Product</Button>}
          >
            Product Data Generation Demo
          </Header>
        </SpaceBetween>
      }
    >
      <SpaceBetween size="l">
        {(generateProduct.isSuccess || generateProduct.isError) && (
          <ReviewProductDataStep
            productData={generateProduct.data?.product}
            isLoading={generateProduct.isLoading}
            status={generateProduct.status}
          />
        )}
        <Container
          header={
            <Header
              variant="h2"
              description="Provide product images and optional metadata"
            >
              Product Input
            </Header>
          }
        >
          <SpaceBetween size="l">
            <ImageUploader
              value={imageFiles}
              setValue={(images) => setImageFiles(images)}
            />
            <ProductMetadata
              value={productMetadata}
              setValue={(metadata) => setProductMetadata(metadata)}
            />
            <ExpandableSection
              variant="container"
              headerText="Example Products"
              headerDescription="Optional examples of product titles and descriptions to set the language, style, and tone."
            >
              <Examples value={examples} setValue={setExamples} />
            </ExpandableSection>
            <ExpandableSection
              variant="container"
              headerText="Generation Options"
              headerDescription="Configure how the product content will be generated"
            >
              <LLMOptionsForm options={llmOptions} setOptions={setLLMOptions} />
            </ExpandableSection>
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                void generateProductData();
              }}
              loading={status !== "" && status !== "Error"}
              disabled={status !== "" && status !== "Error"}
              loadingText={generateProduct.isLoading ? "Generating" : status}
            >
              Generate
            </Button>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default GenProductDataDemo;
