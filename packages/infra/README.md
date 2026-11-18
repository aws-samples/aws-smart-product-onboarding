## Getting started

This package is the AWS CDK app for the accelerator. `src/main.ts` creates the app, adds the
[cdk-nag](https://github.com/cdklabs/cdk-nag) `AwsSolutionsChecks` rules, and defines the application stack.

Run these from the repository root:

```shell
pnpm exec nx run @aws-samples/smart-product-onboarding-infra:synth   # build all packages and synthesize
pnpm exec nx run @aws-samples/smart-product-onboarding-infra:test    # unit tests, including the cdk-nag check
pnpm exec nx run @aws-samples/smart-product-onboarding-infra:deploy  # deploy to the account and region in your environment
```

When the `BRANCH` environment variable is set to a branch other than the default branch (`mainline`, or the
`defaultBranchName` context value), the stack name and SSM parameter paths get a prefix based on the branch name.
