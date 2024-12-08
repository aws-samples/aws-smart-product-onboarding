import { UserIdentity } from "@aws/pdk/identity";
import { StaticWebsite } from "@aws/pdk/static-website";
import { Stack } from "aws-cdk-lib";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { Smartproductonboardingapi } from "../apis/smartproductonboardingapi";

/**
 * Website construct props
 */
export interface AwssamplessmartproductonboardingdemowebsiteProps {
  /**
   * Instance of an API to configure the website to integrate with
   */
  readonly smartproductonboardingapi: Smartproductonboardingapi;

  /**
   * Instance of the UserIdentity.
   */
  readonly userIdentity: UserIdentity;
}

/**
 * Construct to deploy a Static Website
 */
export class Awssamplessmartproductonboardingdemowebsite extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props?: AwssamplessmartproductonboardingdemowebsiteProps,
  ) {
    super(scope, id);

    const website = new StaticWebsite(this, id, {
      websiteContentPath: "../website/build",
      runtimeOptions: {
        jsonPayload: {
          region: Stack.of(this).region,
          identityPoolId: props?.userIdentity.identityPool.identityPoolId,
          userPoolId: props?.userIdentity.userPool?.userPoolId,
          userPoolWebClientId:
            props?.userIdentity.userPoolClient?.userPoolClientId,
          typeSafeApis: {
            Smartproductonboardingapi:
              props?.smartproductonboardingapi.api.api.urlForPath(),
          },
          typeSafeWebSocketApis: {},
        },
      },
    });

    NagSuppressions.addResourceSuppressions(
      website,
      [
        {
          id: "AwsPrototyping-CloudFrontDistributionGeoRestrictions",
          reason:
            "Suppressed to allow unrestricted access. Not recommended in production.",
        },
      ],
      true,
    );
  }
}
