/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CognitoAuth } from "@aws-northstar/ui";
import React, { useContext } from "react";
import { RuntimeConfigContext } from "../RuntimeContext";

/**
 * Sets up the Cognito auth.
 *
 * This assumes a runtime-config.json file is present at '/'. In order for Auth to be set up automatically,
 * the runtime-config.json must have the following properties configured: [region, userPoolId, userPoolWebClientId, identityPoolId].
 */
const Auth: React.FC<any> = ({ children }) => {
  const runtimeContext = useContext(RuntimeConfigContext);

  return runtimeContext?.userPoolId &&
    runtimeContext?.userPoolWebClientId &&
    runtimeContext?.region &&
    runtimeContext?.identityPoolId ? (
    <CognitoAuth
      header={runtimeContext.applicationName || "Smart Product Onboarding"}
      userPoolId={runtimeContext.userPoolId}
      clientId={runtimeContext.userPoolWebClientId}
      region={runtimeContext.region}
      identityPoolId={runtimeContext.identityPoolId}
    >
      {children}
    </CognitoAuth>
  ) : (
    <></>
  );
};

export default Auth;
