## What this repository is

An AWS sample: a TypeScript CDK app (`packages/infra`) that deploys an API Gateway REST API with a
Cognito authorizer, Python and TypeScript Lambda handlers, Step Functions workflows, S3 buckets,
DynamoDB tables and Amazon Bedrock calls, plus a React website (`packages/website`). The API is
defined in OpenAPI (`packages/api/model`) and its runtimes are generated from it.

## Rule classes

Every blocking finding names exactly one of these in its `Anchor:` line.

- `auth-on-route`: an API route, Lambda URL, bucket or other endpoint reachable without the
  Cognito authorizer or IAM auth it needs; an authorizer removed or bypassed; one user able to read
  or change another user's data.
- `request-validation`: input from a request, an S3 object, a CSV row or a model response used
  without the validation it needs (types, sizes, allowed values, path or key prefixes), where the
  missing check causes a wrong result, a crash or access outside the caller's data.
- `iam-least-privilege`: a grant wider than the code needs, such as `*` actions or resources, a
  whole-bucket or whole-table grant where a prefix or a single resource would do, or a new trust
  relationship.
- `logical-id-stability`: a CDK change that renames or moves a construct so a stateful resource
  (table, bucket, user pool, log group) gets a new logical ID and is replaced, losing data.
- `secrets-log-hygiene`: credentials, tokens, keys or account-specific values committed to the
  repository, or request headers, tokens, user identities or personal data written to logs or
  responses.
- `broken-contract`: a change to the OpenAPI model, a handler, a Step Functions state, an
  environment variable or a config file that a caller, the website, a test or a deploy step still
  relies on in the old form.
- `weakened-tests-ci`: a test, assertion, cdk-nag rule or CI check removed, skipped, loosened or
  made unable to fail, without the behaviour it covered being removed too.
- `defect`: any other bug with an observable wrong outcome in normal use.

## What is not a finding

Style, naming, formatting, missing comments, refactoring ideas, performance without a measured
problem, a new test that could assert more, and anything that only goes wrong if a caller misuses
an API in a way the code does not do.
