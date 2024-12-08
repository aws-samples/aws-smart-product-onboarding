/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useCognitoAuthContext } from "@aws-northstar/ui";
import {
  Configuration as smartProductOnboardingApiConfiguration,
  DefaultApi as smartProductOnboardingApi,
} from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import { useContext, useMemo } from "react";
import { RuntimeConfigContext } from "../components/RuntimeContext";

export const useSmartProductOnboardingApiClient = () => {
  const runtimeContext = useContext(RuntimeConfigContext);
  const { getAuthenticatedUserSession } = useCognitoAuthContext();

  return useMemo(() => {
    const client = async (input: RequestInfo | URL, init?: RequestInit) => {
      const session = await getAuthenticatedUserSession();
      const token = session?.getIdToken().getJwtToken();
      if (input instanceof Request) {
        input.headers.set("Authorization", token || "");
      }
      if (init) {
        init.headers = {
          ...init.headers,
          Authorization: token || "",
        };
      }

      return fetch(input, init);
    };
    return runtimeContext?.typeSafeApis?.["smart-product-onboarding-api"]
      ? new smartProductOnboardingApi(
          new smartProductOnboardingApiConfiguration({
            basePath:
              runtimeContext.typeSafeApis?.["smart-product-onboarding-api"],
            fetchApi: client,
          }),
        )
      : undefined;
  }, [runtimeContext?.typeSafeApis?.["smart-product-onboarding-api"]]);
};
