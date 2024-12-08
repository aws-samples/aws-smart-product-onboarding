/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { DefaultApiClientProvider as SmartProductOnboardingApiClientProvider } from "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks";
import React from "react";
import { useSmartProductOnboardingApiClient } from "../../hooks/useTypeSafeApiClient";

/**
 * Sets up the Type Safe Api clients.
 */
const TypeSafeApiClientProvider: React.FC<any> = ({ children }) => {
  const comawsgenproductdescriptionDescriptionGeneratorClient =
    useSmartProductOnboardingApiClient();

  return (
    <SmartProductOnboardingApiClientProvider
      apiClient={comawsgenproductdescriptionDescriptionGeneratorClient!}
    >
      {children}
    </SmartProductOnboardingApiClientProvider>
  );
};

export default TypeSafeApiClientProvider;
