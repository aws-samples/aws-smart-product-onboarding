# API types

TypeScript types for the API, generated from `packages/api/model/src/main/openapi/main.yaml` with [openapi-typescript](https://openapi-ts.dev/). The file `src/api.d.ts` is checked in, so no generator runs during a normal build.

After changing the OpenAPI definition, regenerate the types and commit the result:

```shell
pnpm exec nx run @aws-samples/smart-product-onboarding-api-types:generate
```

The pull request build regenerates the types and fails if they differ from the committed file.

Import them as types only:

```typescript
import type { components } from "@aws-samples/smart-product-onboarding-api-types";

type GenProductRequestContent = components["schemas"]["GenProductRequestContent"];
```
