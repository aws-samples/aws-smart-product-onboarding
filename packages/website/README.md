# Smart Product Onboarding - Demo website

## Getting started

You will need the `ConfigurationBucket` and `UserPool` Outputs of stack deployment.

For the demo, user sign up is disabled. You will need to [create your user on the Amazon Cognito console](https://docs.aws.amazon.com/cognito/latest/developerguide/how-to-create-user-accounts.html#creating-a-new-user-using-the-console) in the `UserPool` so you can log in.

1. Navigate to the Amazon Cognito console.
2. Find your User Pool using the `UserPoolId` from the stack deployment outputs.
3. In the "Users" section, click "Create user" and follow the instructions.

To run this frontend locally while developing you must first download the `runtime-config.json` from the configuration bucket and copy it to the `public` folder of the website.

```shell
cd packages/website
aws s3 cp s3://<ConfigurationBucket>/frontend/runtime-config.json public/runtime-config.json
```

Then you can start the website by running

```shell
pnpm dev
```

The first time you sign in with a temporary password, the website asks you to choose a new one. Use **Forgot your password?** on the sign-in page to reset a password with a code sent to the user's email address.

## How it is built

- [React Aria Components](https://react-spectrum.adobe.com/react-aria/) for accessible, unstyled UI components, styled with [Tailwind CSS](https://tailwindcss.com/) v4. The colors are CSS variables in `src/styles.css`, one set per theme, so you can restyle the app by changing them.
- [TanStack Query](https://tanstack.com/query) with [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) and [openapi-react-query](https://openapi-ts.dev/openapi-react-query/) to call the API. The calls are typed from the OpenAPI definition in `packages/api/model/src/main/openapi/main.yaml`.
- [Amplify Auth](https://docs.amplify.aws/react/build-a-backend/auth/) to sign in to the Amazon Cognito user pool. Requests send the user's ID token in the `Authorization` header.

### Regenerating the API types

`src/api/schema.d.ts` is generated from the OpenAPI definition and checked in. After you change the API definition, regenerate it:

```shell
pnpm exec nx run @aws-samples/smart-product-onboarding-demo-website:generate-api
```

The PR build fails if the checked-in file doesn't match the definition.

### Tests

```shell
pnpm exec nx run @aws-samples/smart-product-onboarding-demo-website:test
```

## Warning about hosting

It is definitely recommended to perform a thorough security testing, including pen-tests, before hosting this Front-end
application publicly. The work is provided “AS IS” without warranties or conditions of any kind, either express or
implied, including warranties or conditions of merchantability.
