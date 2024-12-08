/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Box } from "@cloudscape-design/components";

const ValueWithLabel = (props: {
  label: string;
  children: React.ReactNode;
}) => (
  <div>
    <Box variant="awsui-key-label">{props.label}</Box>
    <div>{props.children}</div>
  </div>
);

export default ValueWithLabel;
