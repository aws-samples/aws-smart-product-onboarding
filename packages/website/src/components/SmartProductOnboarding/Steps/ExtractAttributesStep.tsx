/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useExtractAttributes } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  SpaceBetween,
  StatusIndicatorProps,
  Steps,
} from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import AttributesResults from "../../AttributesResults";

export interface ExtractAttributesStepProps {
  extractAttributes: ReturnType<typeof useExtractAttributes>;
}

const STATUS_MAP: Record<string, StatusIndicatorProps.Type> = {
  success: "success",
  error: "error",
  loading: "loading",
  idle: "pending",
};

const ExtractAttributesStep: React.FC<ExtractAttributesStepProps> = ({
  extractAttributes,
}) => {
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Review the automatically determined product attributes"
        >
          Product Attributes
        </Header>
      }
    >
      <SpaceBetween size="m" direction="vertical">
        <Steps
          steps={[
            {
              header: "Extract attributes",
              status: STATUS_MAP[extractAttributes.status ?? "idle"],
            },
          ]}
        />
        {extractAttributes.isSuccess && (
          <AttributesResults attributes={extractAttributes.data} />
        )}
      </SpaceBetween>
    </Container>
  );
};
export default ExtractAttributesStep;
