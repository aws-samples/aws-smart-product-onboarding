/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React from "react";
import { Button } from "./Button";

/** Keeps the app shell when a page fails to load, for example after a redeploy removed an old chunk. */
export class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  static getDerivedStateFromError() {
    return { failed: true };
  }

  state = { failed: false };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div
        role="alert"
        className="grid min-h-64 place-items-center gap-3 p-10 text-center"
      >
        <p className="font-semibold">This page could not be loaded.</p>
        <p className="text-muted text-[13px]">
          The website may have been updated. Reload to get the latest version.
        </p>
        <Button variant="primary" onPress={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    );
  }
}
