/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { CfnOutput } from "aws-cdk-lib";
import { UserPool, UserPoolClient } from "aws-cdk-lib/aws-cognito";
import {
  IdentityPool,
  UserPoolAuthenticationProvider,
} from "aws-cdk-lib/aws-cognito-identitypool";
import { Construct } from "constructs";

export interface UserIdentityProps {
  /**
   * The user pool that signs in users of the web client.
   */
  readonly userPool: UserPool;
}

/**
 * A web client for a user pool and an identity pool that trusts it.
 *
 * The construct IDs match the ones used by earlier versions of this sample, so
 * existing deployments keep their user pool client and identity pool.
 */
export class UserIdentity extends Construct {
  readonly identityPool: IdentityPool;
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, id: string, props: UserIdentityProps) {
    super(scope, id);

    this.userPool = props.userPool;
    this.identityPool = new IdentityPool(this, "IdentityPool");
    this.userPoolClient = this.userPool.addClient("WebClient", {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });
    this.identityPool.addUserPoolAuthentication(
      new UserPoolAuthenticationProvider({
        userPool: this.userPool,
        userPoolClient: this.userPoolClient,
      }),
    );

    new CfnOutput(this, `${id}-UserPoolId`, {
      value: this.userPool.userPoolId,
    });
    new CfnOutput(this, `${id}-IdentityPoolId`, {
      value: this.identityPool.identityPoolId,
    });
  }
}
