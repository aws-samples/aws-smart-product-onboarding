/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import ErrorMessage from "@aws-northstar/ui/components/CognitoAuth/components/ErrorMessage";
import { Spinner } from "@cloudscape-design/components";
import React, { createContext, useEffect, useState } from "react";

export interface RuntimeContext {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolWebClientId: string;
  readonly identityPoolId: string;

  readonly [additionalProps: string]: any;
}

/**
 * Context for storing the runtimeContext.
 */
export const RuntimeConfigContext = createContext<RuntimeContext | undefined>(
  undefined,
);

/**
 * Sets up the runtimeContext.
 *
 * This assumes a runtime-config.json file is present at '/'. In order for Auth to be set up automatically,
 * the runtime-config.json must have the following properties configured: [region, userPoolId, userPoolWebClientId, identityPoolId].
 */
const RuntimeContextProvider: React.FC<any> = ({ children }) => {
  const [runtimeContext, setRuntimeContext] = useState<
    RuntimeContext | undefined
  >();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    fetch("/runtime-config.json")
      .then((response) => {
        return response.json();
      })
      .then((runtimeCtx) => {
        if (
          runtimeCtx.region &&
          runtimeCtx.userPoolId &&
          runtimeCtx.userPoolWebClientId &&
          runtimeCtx.identityPoolId
        ) {
          setRuntimeContext(runtimeCtx as RuntimeContext);
        } else {
          setError(
            "runtime-config.json should have region, userPoolId, userPoolWebClientId & identityPoolId.",
          );
        }
      })
      .catch(() => {
        setError("No runtime-config.json detected");
      });
  }, [setRuntimeContext]);

  return error ? (
    <ErrorMessage>{error}</ErrorMessage>
  ) : runtimeContext ? (
    <RuntimeConfigContext.Provider value={runtimeContext}>
      {children}
    </RuntimeConfigContext.Provider>
  ) : (
    <Spinner></Spinner>
  );
};

export default RuntimeContextProvider;
