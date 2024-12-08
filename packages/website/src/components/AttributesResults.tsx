/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { ExtractAttributesResponseContent } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { KeyValuePairs } from "@cloudscape-design/components";

export interface AttributesResultsProps {
  attributes: ExtractAttributesResponseContent;
}

const AttributesResults: React.FC<AttributesResultsProps> = ({
  attributes,
}) => {
  return (
    <KeyValuePairs
      items={[
        {
          type: "group",
          title: "Attributes",
          items:
            attributes.attributes.map((attribute) => ({
              label: attribute.name,
              value: attribute.value,
            })) || [],
        },
      ]}
    />
  );
};

export default AttributesResults;
