/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  CategorizeProductResponseContent,
  ExtractAttributesResponseContent,
  ProductData,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Box,
  KeyValuePairs,
  SpaceBetween,
  StatusIndicator,
} from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import AttributesResults from "../../AttributesResults";
import CategorizationResults from "../../CategorizationResults";
import ProductImageCarousel from "../../ProductImageCarousel";

export interface ReviewStepProps {
  imageFiles: File[];
  productData?: Partial<ProductData>;
  classification?: CategorizeProductResponseContent;
  attributes?: ExtractAttributesResponseContent;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  imageFiles,
  productData,
  classification,
  attributes,
}) => {
  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h2"
            description="Review and finalize your product information"
          >
            Final Review
          </Header>
        }
      >
        <SpaceBetween size="l">
          <ProductImageCarousel imageFiles={imageFiles} />
          <Container header={<Header variant="h3">Product Content</Header>}>
            <KeyValuePairs
              items={[
                {
                  label: "Title",
                  value: productData?.title || "",
                },
                {
                  label: "Description",
                  value: (
                    <Box variant="div">
                      {productData?.description
                        ?.split("\n\n")
                        .map((paragraph: string) => (
                          <Box variant="p">{paragraph}</Box>
                        ))}
                    </Box>
                  ),
                },
              ]}
            />
          </Container>

          <Container header={<Header variant="h3">Classification</Header>}>
            {classification ? (
              <CategorizationResults classification={classification} />
            ) : (
              <SpaceBetween size="l">
                <StatusIndicator type="error">
                  Categorize the product
                </StatusIndicator>
              </SpaceBetween>
            )}
          </Container>
          <Container header={<Header variant="h3">Product Attributes</Header>}>
            {attributes ? (
              <AttributesResults attributes={attributes} />
            ) : (
              <SpaceBetween size="l">
                <StatusIndicator type="error">
                  Extract attributes from the product
                </StatusIndicator>
              </SpaceBetween>
            )}
          </Container>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

export default ReviewStep;
