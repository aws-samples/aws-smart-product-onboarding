/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ProductData } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Container,
  ExpandableSection,
  SpaceBetween,
} from "@cloudscape-design/components";
import Examples from "./Examples";
import ImageUploader from "./ImageUploader";
import ProductMetadata from "./ProductMetadata";
import LLMOptionsForm, {
  LLMOptions,
} from "../GenerationOptions/LLMOptionsForm";

const NewProductForm = (props: {
  imageFiles: File[];
  setImageFiles: (value: ((prevState: File[]) => File[]) | File[]) => void;
  productMetadata: string;
  setProductMetadata: (value: ((prevState: string) => string) | string) => void;
  examples: ProductData[];
  setExamples: (
    value: ((prevState: ProductData[]) => ProductData[]) | ProductData[],
  ) => void;
  llmOptions: LLMOptions;
  setLLMOptions: (
    value: ((prevState: LLMOptions) => LLMOptions) | LLMOptions,
  ) => void;
}) => {
  return (
    <SpaceBetween size="l">
      <Container>
        <SpaceBetween direction="vertical" size="l">
          <ImageUploader
            value={props.imageFiles}
            setValue={props.setImageFiles}
          />
          <ProductMetadata
            value={props.productMetadata}
            setValue={props.setProductMetadata}
          />
          <Examples value={props.examples} setValue={props.setExamples} />
          <ExpandableSection headerText="Options">
            <LLMOptionsForm
              options={props.llmOptions}
              setOptions={props.setLLMOptions}
            />
          </ExpandableSection>
        </SpaceBetween>
      </Container>
    </SpaceBetween>
  );
};

export default NewProductForm;
