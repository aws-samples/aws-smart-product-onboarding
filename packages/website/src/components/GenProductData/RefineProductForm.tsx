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
import { useState } from "react";
import Examples from "./Examples";
import ProductMetadata from "./ProductMetadata";
import LLMOptionsForm, {
  LLMOptions,
} from "../GenerationOptions/LLMOptionsForm";

const RefineProductForm = (props: {
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
  expanded: boolean;
}) => {
  const [expanded, setExpanded] = useState(props.expanded);
  return (
    <SpaceBetween size="l">
      <Container>
        <ExpandableSection
          expanded={expanded}
          onChange={() => setExpanded((prev) => !prev)}
          headerText="Options"
        >
          <SpaceBetween direction="vertical" size="l">
            <ProductMetadata
              value={props.productMetadata}
              setValue={props.setProductMetadata}
            />
            <Examples value={props.examples} setValue={props.setExamples} />
            <LLMOptionsForm
              options={props.llmOptions}
              setOptions={props.setLLMOptions}
            />
          </SpaceBetween>
        </ExpandableSection>
      </Container>
    </SpaceBetween>
  );
};

export default RefineProductForm;
