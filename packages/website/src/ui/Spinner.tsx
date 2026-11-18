/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";

export const Spinner: React.FC<{ className?: string; label?: string }> = ({
  className = "",
  label,
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <svg
      viewBox="0 0 24 24"
      className="size-4 animate-spin"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
    {label && <span>{label}</span>}
  </span>
);
