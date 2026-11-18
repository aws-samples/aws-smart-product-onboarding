/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** Inline error with an optional retry action. */
export const ErrorAlert: React.FC<{
  title: string;
  detail?: string;
  onRetry?: () => void;
}> = ({ title, detail, onRetry }) => (
  <div
    role="alert"
    className="border-err bg-err-soft text-text flex items-start gap-3 rounded-md border p-3"
  >
    <Icon name="alert" className="text-err mt-0.5 size-4" />
    <div className="min-w-0 flex-1">
      <p className="font-semibold">{title}</p>
      {detail && (
        <p className="text-muted mt-0.5 text-[13px] break-words">{detail}</p>
      )}
    </div>
    {onRetry && (
      <Button size="sm" onPress={onRetry}>
        Retry
      </Button>
    )}
  </div>
);
