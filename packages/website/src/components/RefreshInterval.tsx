/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import {
  Box,
  Button,
  Select,
  SpaceBetween,
} from "@cloudscape-design/components";
import { OptionDefinition } from "@cloudscape-design/components/internal/components/option/interfaces";
import React from "react";

export interface RefreshIntervalProps {
  dataUpdatedAt: number | undefined;
  isFetching: boolean;
  refetch: () => void;
  refreshInterval: OptionDefinition;
  setRefreshInterval: React.Dispatch<React.SetStateAction<OptionDefinition>>;
  disabled?: boolean;
}

const RefreshInterval = (props: RefreshIntervalProps) => {
  return (
    <Box float="right">
      <SpaceBetween size="s" direction="horizontal">
        {props.dataUpdatedAt && (
          <Box color="text-status-inactive" textAlign="right">
            Last updated:
            <br />
            {new Date(props.dataUpdatedAt).toLocaleString()}
          </Box>
        )}
        <Button
          variant="normal"
          iconName="refresh"
          loading={props.isFetching}
          onClick={() => props.refetch()}
          disabled={props.disabled || props.isFetching}
        />
        <Select
          selectedOption={props.refreshInterval}
          onChange={({ detail }) =>
            props.setRefreshInterval(detail.selectedOption)
          }
          options={[
            { label: "Off", value: undefined },
            { label: "10 seconds", value: "10000" },
            { label: "30 seconds", value: "30000" },
            { label: "1 minute", value: "60000" },
            { label: "5 minutes", value: "300000" },
            { label: "10 minutes", value: "600000" },
          ]}
          disabled={props.disabled}
        />
      </SpaceBetween>
    </Box>
  );
};

export default RefreshInterval;
