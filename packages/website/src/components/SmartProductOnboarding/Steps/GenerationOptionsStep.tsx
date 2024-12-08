/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import LLMOptionsForm, {
  LLMOptions,
} from "../../GenerationOptions/LLMOptionsForm";

export interface GenerationOptionsStepProps {
  options: LLMOptions;
  setOptions: React.Dispatch<React.SetStateAction<LLMOptions>>;
}

const GenerationOptionsStep: React.FC<GenerationOptionsStepProps> = ({
  options,
  setOptions,
}) => {
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Configure how the product content will be generated"
        >
          Generation Options
        </Header>
      }
    >
      <LLMOptionsForm options={options} setOptions={setOptions} />
    </Container>
  );
};

export default GenerationOptionsStep;
