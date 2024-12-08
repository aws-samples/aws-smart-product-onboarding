/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { SpaceBetween } from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import ImageUploader from "../../GenProductData/ImageUploader";
import ProductMetadata from "../../GenProductData/ProductMetadata";

export interface ProductInputStepProps {
  imageFiles: File[];
  setImageFiles: (files: File[]) => void;
  productMetadata: string;
  setProductMetadata: (metadata: string) => void;
}

const ProductInputStep: React.FC<ProductInputStepProps> = ({
  imageFiles,
  setImageFiles,
  productMetadata,
  setProductMetadata,
}) => {
  return (
    <SpaceBetween size="l">
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
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

export default ProductInputStep;
