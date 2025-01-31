/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { GenProductRequestContentDescriptionLengthEnum } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { Select, SpaceBetween } from "@cloudscape-design/components";
import FormField from "@cloudscape-design/components/form-field";
import React from "react";

interface DescriptionLengthSelectorProps {
  value?: GenProductRequestContentDescriptionLengthEnum;
  onChange: (value: string | undefined) => void;
}

const DescriptionLengthSelector: React.FC<DescriptionLengthSelectorProps> = ({
  value,
  onChange,
}) => {
  const options = [
    { value: undefined },
    { label: "Short", value: "short" },
    { label: "Medium", value: "medium" },
    { label: "Long", value: "long" },
  ];

  return (
    <FormField label="Description Length" description="Select desired length">
      <SpaceBetween direction="horizontal" size="xs">
        <Select
          placeholder="Desired length"
          selectedOption={
            value
              ? {
                  label: value.charAt(0).toUpperCase() + value.slice(1),
                  value,
                }
              : null
          }
          onChange={({ detail }) => onChange(detail.selectedOption.value)}
          options={options}
        />
      </SpaceBetween>
    </FormField>
  );
};

export default DescriptionLengthSelector;
