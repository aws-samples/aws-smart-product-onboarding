/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { FullPageMessage } from "../ui/FullPageMessage";

/** The deployed stack writes these keys to runtime-config.json. */
export interface RuntimeConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly userPoolWebClientId: string;
  readonly identityPoolId: string;
  readonly typeSafeApis: Record<string, string>;
  readonly applicationName?: string;
}

export const API_KEY = "smart-product-onboarding-api";

export function parseRuntimeConfig(raw: unknown): RuntimeConfig | string {
  if (!raw || typeof raw !== "object") {
    return "runtime-config.json is not a JSON object.";
  }
  const c = raw as Record<string, unknown>;
  for (const key of [
    "region",
    "userPoolId",
    "userPoolWebClientId",
    "identityPoolId",
  ]) {
    if (typeof c[key] !== "string" || !c[key]) {
      return "runtime-config.json should have region, userPoolId, userPoolWebClientId & identityPoolId.";
    }
  }
  const apis = c.typeSafeApis as Record<string, unknown> | undefined;
  if (!apis || typeof apis[API_KEY] !== "string") {
    return `runtime-config.json should have typeSafeApis["${API_KEY}"].`;
  }
  return c as unknown as RuntimeConfig;
}

const RuntimeConfigContext = createContext<RuntimeConfig | undefined>(
  undefined,
);

export const useRuntimeConfig = (): RuntimeConfig => {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error(
      "useRuntimeConfig must be used inside RuntimeConfigProvider",
    );
  }
  return config;
};

/** Loads /runtime-config.json once and provides it to the app. */
export const RuntimeConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [config, setConfig] = useState<RuntimeConfig>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetch("/runtime-config.json")
      .then((response) => response.json())
      .then((raw) => {
        const parsed = parseRuntimeConfig(raw);
        if (typeof parsed === "string") setError(parsed);
        else setConfig(parsed);
      })
      .catch(() => setError("No runtime-config.json detected"));
  }, []);

  if (error)
    return (
      <FullPageMessage title="Configuration error">{error}</FullPageMessage>
    );
  if (!config) return <FullPageMessage title="Loading…" busy />;
  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
};
