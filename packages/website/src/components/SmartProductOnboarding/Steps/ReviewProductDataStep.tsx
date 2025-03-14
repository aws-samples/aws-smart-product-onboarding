/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ProductData } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import ProductImageCarousel from "../../ProductImageCarousel";

export interface ReviewProductDataStepProps {
  imageFiles: File[];
  productData?: Partial<ProductData>;
  setProductData?: React.Dispatch<React.SetStateAction<Partial<ProductData>>>;
  isLoading?: boolean;
  status?: string;
}

const ReviewProductDataStep: React.FC<ReviewProductDataStepProps> = (
  props: ReviewProductDataStepProps,
) => {
  switch (props.status) {
    case "Success":
    case "":
    case "success": {
      return (
        <SpaceBetween size="l">
          <ProductImageCarousel imageFiles={props.imageFiles} />
          <Container
            header={
              <Header
                variant="h2"
                description="Review and edit the generated product content"
              >
                Generated Content
              </Header>
            }
          >
            <SpaceBetween size="l">
              <FormField
                label="Product Title"
                description="A clear and concise title for your product"
              >
                <Input
                  value={props.productData?.title || ""}
                  onChange={({ detail }) =>
                    props.setProductData &&
                    props.setProductData({
                      ...props.productData,
                      title: detail.value,
                    })
                  }
                  placeholder="Generated title will appear here"
                  disabled={props.isLoading}
                />
              </FormField>
              <FormField
                label="Product Description"
                description="A detailed description of your product"
              >
                <Textarea
                  value={props.productData?.description || ""}
                  onChange={({ detail }) =>
                    props.setProductData &&
                    props.setProductData({
                      ...props.productData,
                      description: detail.value,
                    })
                  }
                  placeholder="Generated description will appear here"
                  rows={12}
                  disabled={props.isLoading}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </SpaceBetween>
      );
    }
    case "Error":
    case "error": {
      return (
        <StatusIndicator type="error">
          Failed to generate product data
        </StatusIndicator>
      );
    }
    case "Preparing":
    case "Uploading":
    case "Generating": {
      return (
        <SpaceBetween direction="horizontal" size="s">
          <Spinner />
          <StatusIndicator type="in-progress">{props.status}</StatusIndicator>
        </SpaceBetween>
      );
    }
    default: {
      return props.isLoading ? (
        <StatusIndicator type="in-progress">Loading</StatusIndicator>
      ) : (
        <StatusIndicator type="warning">Unknown Status</StatusIndicator>
      );
    }
  }
};

export default ReviewProductDataStep;
