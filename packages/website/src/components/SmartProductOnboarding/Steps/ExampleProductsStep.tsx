/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ProductData } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Examples from "../../GenProductData/Examples";

export interface ExampleProductsStepProps {
  examples: ProductData[];
  setExamples: React.Dispatch<React.SetStateAction<ProductData[]>>;
}

const ExampleProductsStep: React.FC<ExampleProductsStepProps> = ({
  examples,
  setExamples,
}) => {
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Optional examples of product titles and descriptions to set the language, style, and tone."
        >
          Example Products{" "}
        </Header>
      }
    >
      <Examples value={examples} setValue={setExamples} />
    </Container>
  );
};

export default ExampleProductsStep;
