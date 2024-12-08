/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { useCognitoAuthContext } from "@aws-northstar/ui";
import getCredentials from "@aws-northstar/ui/components/CognitoAuth/hooks/useSigv4Client/utils/getCredentials";
import { S3Client } from "@aws-sdk/client-s3";
import { useMemo } from "react";

function useS3Client(): S3Client {
  const { getAuthenticatedUser, region, identityPoolId, userPoolId } =
    useCognitoAuthContext();

  return useMemo(() => {
    const cognitoUser = getAuthenticatedUser?.();
    if (!cognitoUser) {
      throw new Error("CognitoUser is empty");
    }

    return new S3Client({
      region: region,
      credentials: () =>
        getCredentials(cognitoUser, region, identityPoolId, userPoolId),
    });
  }, [getAuthenticatedUser, region, identityPoolId, userPoolId]);
}

export default useS3Client;
