/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ProductData } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Button,
  Icon,
  Link,
  SpaceBetween,
  WizardProps,
} from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import { NonCancelableEventHandler } from "@cloudscape-design/components/internal/events";
import Wizard from "@cloudscape-design/components/wizard";
import { useEffect, useState } from "react";
import ClassificationStep from "../../components/SmartProductOnboarding/Steps/ClassificationStep";
import ExampleProductsStep from "../../components/SmartProductOnboarding/Steps/ExampleProductsStep";
import ExtractAttributesStep from "../../components/SmartProductOnboarding/Steps/ExtractAttributesStep";
import GenerationOptionsStep from "../../components/SmartProductOnboarding/Steps/GenerationOptionsStep";
import ProductInputStep from "../../components/SmartProductOnboarding/Steps/ProductInputStep";
import ReviewProductDataStep from "../../components/SmartProductOnboarding/Steps/ReviewProductDataStep";
import ReviewStep from "../../components/SmartProductOnboarding/Steps/ReviewStep";
import { useAttributeExtraction } from "../../hooks/useAttributeExtraction";
import { useCategorization } from "../../hooks/useCategorization";
import { useGlobalUIContext } from "../../hooks/useGlobalUIContext";
import { useProductGeneration } from "../../hooks/useProductGeneration";

const SmartProductOnboarding: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [productData, setProductData] = useState<Partial<ProductData>>({
    title: "",
    description: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { addFlashItem, setHelpPanelTopic, makeHelpPanelHandler } =
    useGlobalUIContext();

  useEffect(() => {
    setHelpPanelTopic("smart-onboarding:overview");
  }, [setHelpPanelTopic]);

  const {
    imageFiles,
    setImageFiles,
    productMetadata,
    setProductMetadata,
    examples,
    setExamples,
    llmOptions,
    setLLMOptions,
    generateProduct,
    generateProductData,
    handleReset: handleResetProductGeneration,
    status: productGenerationStatus,
  } = useProductGeneration(setProductData);

  const {
    metaclass,
    categorizeProduct,
    startCategorization,
    handleReset: handleResetCategorization,
  } = useCategorization();

  const { extractAttributes, handleReset: handleResetAttributeExtraction } =
    useAttributeExtraction();

  const steps: WizardProps.Step[] = [
    {
      title: "Enter your product images and metadata",
      content: (
        <ProductInputStep
          imageFiles={imageFiles}
          setImageFiles={setImageFiles}
          productMetadata={productMetadata}
          setProductMetadata={setProductMetadata}
        />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:product-input");
          }}
        >
          Info
        </Link>
      ),
    },
    {
      title: "Configure generation options",
      content: (
        <GenerationOptionsStep
          options={llmOptions}
          setOptions={setLLMOptions}
        />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:generation-options");
          }}
        >
          Info
        </Link>
      ),
      isOptional: true,
    },
    {
      title: "Provide example products",
      content: (
        <ExampleProductsStep examples={examples} setExamples={setExamples} />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:example-products");
          }}
        >
          Info
        </Link>
      ),
      isOptional: true,
    },

    {
      title: "Generate product data",
      content: (
        <ReviewProductDataStep
          imageFiles={imageFiles}
          productData={productData}
          setProductData={setProductData}
          isLoading={
            generateProduct.isLoading || productGenerationStatus !== ""
          }
          status={productGenerationStatus}
        />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:review-content");
          }}
        >
          Info
        </Link>
      ),
    },
    {
      title: "Categorize product",
      content: (
        <ClassificationStep
          metaclass={metaclass}
          categorizeProduct={categorizeProduct}
        />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:review-classification");
          }}
        >
          Info
        </Link>
      ),
    },
    {
      title: "Extract attributes",
      content: <ExtractAttributesStep extractAttributes={extractAttributes} />,
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:extract-attributes");
          }}
        >
          Info
        </Link>
      ),
    },
    {
      title: "Review",
      content: (
        <ReviewStep
          imageFiles={imageFiles}
          productData={productData}
          classification={categorizeProduct.data}
          attributes={extractAttributes.data}
        />
      ),
      info: (
        <Link
          variant="info"
          onClick={() => {
            makeHelpPanelHandler("smart-onboarding:final-review");
          }}
        >
          Info
        </Link>
      ),
    },
  ];

  useEffect(() => {
    setIsLoading(
      (activeStepIndex <= 3 &&
        (generateProduct.isLoading ||
          (productGenerationStatus !== "" &&
            productGenerationStatus !== "Error"))) ||
        (activeStepIndex === 4 &&
          (categorizeProduct.isLoading || metaclass.isLoading)) ||
        (activeStepIndex === 5 && extractAttributes.isLoading) ||
        false,
    );
  }, [
    activeStepIndex,
    productGenerationStatus,
    metaclass.isLoading,
    generateProduct.isLoading,
    categorizeProduct.isLoading,
    extractAttributes.isLoading,
  ]);

  const handleSubmit = () => {
    addFlashItem({
      type: "success",
      content: "Product created successfully",
    });
  };

  const onNavigate: NonCancelableEventHandler<
    WizardProps.NavigateDetail
  > = async ({ detail }: { detail: WizardProps.NavigateDetail }) => {
    // TODO: validate steps before advancing
    if (
      detail.requestedStepIndex === 3 &&
      !(
        productData.title &&
        productData.title !== "" &&
        productData.description &&
        productData.description !== ""
      )
    ) {
      await generateProductData();
    }
    if (
      detail.requestedStepIndex === 4 &&
      !categorizeProduct.isSuccess &&
      productData.title &&
      productData.title !== "" &&
      productData.description &&
      productData.description !== ""
    ) {
      startCategorization(productData as ProductData);
    }
    if (
      detail.requestedStepIndex === 5 &&
      !extractAttributes.isSuccess &&
      categorizeProduct.isSuccess &&
      productData.title &&
      productData.title !== "" &&
      productData.description &&
      productData.description !== ""
    ) {
      extractAttributes.mutate({
        extractAttributesRequestContent: {
          product: {
            ...(productData as ProductData),
            metadata: productMetadata,
          },
          categoryId: categorizeProduct.data.categoryId,
        },
      });
    }
    setActiveStepIndex(detail.requestedStepIndex);
  };

  return (
    <ContentLayout
      header={
        <SpaceBetween size="m">
          <Header
            variant="h1"
            description="Create product listings with AI-generated content"
          >
            Smart Product Onboarding
            <Link
              variant="info"
              onClick={() => {
                makeHelpPanelHandler("smart-onboarding:overview");
              }}
            >
              Info
            </Link>
          </Header>
        </SpaceBetween>
      }
    >
      <Container>
        <SpaceBetween size="xs">
          <form onSubmit={(e) => e.preventDefault()}>
            <Wizard
              steps={steps}
              activeStepIndex={activeStepIndex}
              onNavigate={onNavigate}
              allowSkipTo={true}
              i18nStrings={{
                stepNumberLabel: (stepNumber) => `Step ${stepNumber}`,
                collapsedStepsLabel: (stepNumber, stepsCount) =>
                  `Step ${stepNumber} of ${stepsCount}`,
                cancelButton: "Cancel",
                previousButton: "Previous",
                nextButton: "Next",
                submitButton: "Submit",
              }}
              onCancel={() => {
                handleResetProductGeneration();
                handleResetCategorization();
                handleResetAttributeExtraction();
                setProductData({});
                setActiveStepIndex(0);
              }}
              onSubmit={handleSubmit}
              isLoadingNextStep={isLoading}
              secondaryActions={
                (activeStepIndex === 3 && (
                  <Button
                    variant="normal"
                    onClick={(e) => {
                      e.preventDefault();
                      void generateProductData();
                    }}
                    disabled={isLoading}
                  >
                    <SpaceBetween size="xs" direction="horizontal">
                      <Icon name="gen-ai" />
                      <>Regenerate</>
                    </SpaceBetween>
                  </Button>
                )) ||
                (activeStepIndex === 4 && (
                  <Button
                    variant="normal"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!generateProduct.isSuccess) return;
                      void startCategorization(productData as ProductData);
                    }}
                    disabled={isLoading}
                  >
                    <SpaceBetween size="xs" direction="horizontal">
                      <Icon name="gen-ai" />
                      <>Regenerate</>
                    </SpaceBetween>
                  </Button>
                )) ||
                (activeStepIndex === 5 && (
                  <Button
                    variant="normal"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!categorizeProduct.isSuccess) return;
                      void extractAttributes.mutateAsync({
                        extractAttributesRequestContent: {
                          product: {
                            ...(productData as ProductData),
                            metadata: productMetadata,
                          },
                          categoryId: categorizeProduct.data.categoryId,
                        },
                      });
                    }}
                    disabled={isLoading}
                  >
                    <SpaceBetween size="xs" direction="horizontal">
                      <Icon name="gen-ai" />
                      <>Regenerate</>
                    </SpaceBetween>
                  </Button>
                ))
              }
            />
          </form>
        </SpaceBetween>
      </Container>
    </ContentLayout>
  );
};

export default SmartProductOnboarding;
