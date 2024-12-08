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
pnpm pdk dev
```

### Additional resources

Refer to [Developer Guide](https://aws.github.io/aws-pdk/developer_guides/cloudscape-react-ts-website/index.html)

## Warning about hosting

It is definitely recommended to perform a thorough security testing, including pen-tests, before hosting this Front-end 
application publicly. The work is provided “AS IS” without warranties or conditions of any kind, either express or 
implied, including warranties or conditions of merchantability.
