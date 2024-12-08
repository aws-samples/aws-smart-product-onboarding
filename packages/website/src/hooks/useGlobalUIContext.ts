/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useContext, useMemo } from "react";
import { GlobalUIContext } from "../components/GlobalUIContextProvider";

export const useGlobalUIContext = () => {
  const globalUIContext = useContext(GlobalUIContext);
  return useMemo(() => {
    return globalUIContext;
  }, [globalUIContext]);
};
