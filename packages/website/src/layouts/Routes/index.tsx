/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as React from "react";
import { Route, Routes as ReactRoutes } from "react-router-dom";
import BatchOnboarding from "../../pages/BatchOnboarding";
import GenProductDataDemo from "../../pages/GenProductDataDemo";
import Home from "../../pages/Home";
import SmartProductOnboarding from "../../pages/SmartProductOnboarding";

/**
 * Defines the Routes.
 */
const Routes: React.FC = () => {
  return (
    <ReactRoutes>
      <Route key={0} path="/" element={<Home />} />
      <Route
        key={0}
        path="/smartProductOnboarding"
        element={<SmartProductOnboarding />}
      />
      <Route key={0} path="/batchOnboarding" element={<BatchOnboarding />} />
      <Route key={0} path="/genProductData" element={<GenProductDataDemo />} />
    </ReactRoutes>
  );
};

export default Routes;
