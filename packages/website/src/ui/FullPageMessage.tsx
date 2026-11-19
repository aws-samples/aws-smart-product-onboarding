/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import { Spinner } from "./Spinner";

export const FullPageMessage: React.FC<{
  title: string;
  busy?: boolean;
  children?: React.ReactNode;
}> = ({ title, busy, children }) => (
  <main className="grid min-h-screen place-items-center p-6">
    <div
      className="panel w-full max-w-md p-6 text-center"
      role={busy ? "status" : "alert"}
    >
      {busy && <Spinner className="mx-auto mb-3" />}
      <h1 className="text-lg font-bold">{title}</h1>
      {children && <p className="text-muted mt-2">{children}</p>}
    </div>
  </main>
);
