/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { aws_s3 as s3, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";

export class SecureBucket extends s3.Bucket {
  constructor(scope: Construct, id: string, props: s3.BucketProps) {
    super(scope, id, {
      versioned: true,
      serverAccessLogsPrefix: "logs/",
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      lifecycleRules: [
        {
          enabled: true,
          expiration: Duration.days(90),
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
      ...props,
    });
  }
}
