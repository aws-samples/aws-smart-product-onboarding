# API

The REST API is defined by the OpenAPI definition in `model/src/main/openapi/main.yaml`. That file is the contract for the infrastructure, the Lambda handlers and the website.

## Project Structure

- `model/`: the OpenAPI definition. Its `generate` target bundles it into `model/.api.json`, which the infrastructure reads. See the [model README](./model/README.md).
- `generated/types/typescript/`: TypeScript types generated from the definition with [openapi-typescript](https://openapi-ts.dev/) and checked in.
- `handlers/typescript/`: the TypeScript Lambda handler for `generateProduct`.
- `generated/documentation/`: Markdown documentation that `scripts/generate-pdf-doc.sh` generates. It is not checked in.

The Python handlers live in `packages/smart-product-onboarding/api/handlers/`, and their pydantic models in `packages/smart-product-onboarding/api/common/`.

## Adding Operations

1. Add the operation to `model/src/main/openapi/main.yaml`.
2. Regenerate the checked-in types and models, and commit the result. The pull request build fails if they differ from the definition.

   ```shell
   pnpm exec nx run @aws-samples/smart-product-onboarding-api-types:generate
   pnpm exec nx run amzn-smart-product-onboarding-api-python-common:generate
   pnpm exec nx run @aws-samples/smart-product-onboarding-demo-website:generate-api
   ```

3. Implement a Lambda handler for it.
4. Add the function to the `integrations` of the API in `packages/infra/src/constructs/apis/smartproductonboardingapi.ts`. Synth fails if an operation in the definition has no integration.
