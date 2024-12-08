/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Textarea } from "@cloudscape-design/components";
import FormField from "@cloudscape-design/components/form-field";

export interface ProductMetadataProps {
  value: string;
  setValue: (value: string) => void;
}

const ProductMetadata: React.FC<ProductMetadataProps> = (
  props: ProductMetadataProps,
) => {
  const { value, setValue } = props;

  return (
    <FormField label="Product Metadata" description="Optional product details">
      <Textarea
        value={value}
        onChange={({ detail }) => setValue(detail.value)}
        placeholder="Optional product metadata"
      ></Textarea>
    </FormField>
  );
};

export default ProductMetadata;
