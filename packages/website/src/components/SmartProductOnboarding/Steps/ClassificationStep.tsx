/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  useCategorizeProduct,
  useMetaclass,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  SpaceBetween,
  StatusIndicatorProps,
  Steps,
} from "@cloudscape-design/components";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import CategorizationResults from "../../CategorizationResults";

export interface ClassificationStepProps {
  metaclass: ReturnType<typeof useMetaclass>;
  categorizeProduct: ReturnType<typeof useCategorizeProduct>;
}

const STATUS_MAP: Record<string, StatusIndicatorProps.Type> = {
  success: "success",
  error: "error",
  loading: "loading",
  idle: "pending",
};

const ClassificationStep: React.FC<ClassificationStepProps> = ({
  metaclass,
  categorizeProduct,
}) => {
  return (
    <Container
      header={
        <Header
          variant="h2"
          description="Review the automatically determined product classification"
        >
          Product Classification
        </Header>
      }
    >
      <SpaceBetween size="m" direction="vertical">
        <Steps
          steps={[
            {
              header: "Predict metaclass",
              status: STATUS_MAP[metaclass.status ?? "idle"],
            },
            {
              header: "Categorize product",
              status: STATUS_MAP[categorizeProduct.status ?? "idle"],
            },
          ]}
        />
        {categorizeProduct.isSuccess && (
          <CategorizationResults classification={categorizeProduct.data} />
        )}
      </SpaceBetween>
    </Container>
  );
};
export default ClassificationStep;
