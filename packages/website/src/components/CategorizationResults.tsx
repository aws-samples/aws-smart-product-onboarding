/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CategorizeProductResponseContent } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import {
  Box,
  Container,
  Header,
  KeyValuePairs,
  SpaceBetween,
} from "@cloudscape-design/components";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import "./categorizationResults.css";

export interface CategorizationResultsProps {
  classification: CategorizeProductResponseContent;
}

const CategorizationResults: React.FC<CategorizationResultsProps> = ({
  classification,
}) => {
  return (
    <SpaceBetween size="l" direction="vertical">
      <KeyValuePairs
        items={[
          {
            type: "group",
            title: "Category",
            items: [
              {
                label: "Category ID",
                value: classification.categoryId,
              },
              {
                label: "Full Path",
                value: classification.categoryPath,
              },
            ],
          },
        ]}
      />
      <ExpandableSection
        headerText={"Classification Details"}
        defaultExpanded={false}
      >
        <SpaceBetween size="l" direction="vertical">
          {classification.explanation && (
            <Container header={<Header variant="h3">Explanation</Header>}>
              <Box variant="p">{classification.explanation}</Box>
            </Container>
          )}
          {classification.prompt && (
            <Container header={<Header variant="h3">Prompt</Header>}>
              <Box variant="pre">{classification.prompt}</Box>
            </Container>
          )}
        </SpaceBetween>
      </ExpandableSection>
    </SpaceBetween>
  );
};

export default CategorizationResults;
