# AI pull request review

Two advisory review lanes run on Amazon Bedrock: Claude Opus (`global.anthropic.claude-opus-5-5`) and
GPT (`global.openai.gpt-6.2-sol`). Each lane works alone and never sees the other lane's output. It
makes two model calls:

1. **Discovery** lists candidate defects in the change.
2. **Falsification** tries to disprove each candidate and keeps only those it can re-derive from
   the code: a concrete trigger, the call path, and an observable wrong outcome.

The verdict is `PASS` or `BLOCK`. A blocking item must have a `Trigger:`, an `Outcome:` and an
`Anchor:` naming one of the rule classes in [`prompts/rubric.md`](prompts/rubric.md). A `BLOCK`
without such an item is published as `PASS`. A reply without the `[AI-REVIEWED] <head SHA>` marker
is published as incomplete, never as a pass.

Each lane posts one PR comment, which it replaces on the next run, and an `AI review: <lane>` check
run on the head commit. The checks are advisory: don't make them required.

## When it runs

- **Same-repo pull requests:** on every push (`ai-review.yml`). Draft and Dependabot pull
  requests are skipped.
- **Fork pull requests:** never automatically. A maintainer with write or admin permission
  comments `/ai-review` (or `/ai-review <head SHA>` to require that exact commit) on the pull
  request (`ai-review-command.yml`).

## How it is kept safe

- Pull request code is read through the GitHub API as data. It is never checked out, built or run.
- The reviewer scripts and prompts come from the base commit, or from the default branch for
  `/ai-review`. The one exception is a same-repo pull request whose base has no reviewer yet,
  such as the one that adds it. Its workflow file comes from the pull request anyway.
- The pull request's title, description, diff and files reach the model wrapped in delimiters with a
  random nonce, labelled as untrusted data. The model has no tools.
- Workflows start with no token permissions and grant each job only what it needs. Checkouts use
  `persist-credentials: false`, and actions are pinned to commits.
- Python dependencies are installed with `--require-hashes` before any AWS credentials exist. The
  role is assumed only for the review step.
- Comments and check output are redacted for account IDs, ARNs and key or token shapes, and
  `@mentions` are neutralized.

## Setup

1. Deploy [`iam.yaml`](iam.yaml) as a CloudFormation stack in `us-west-2`, with `CAPABILITY_IAM`. If
   the account already has the GitHub OIDC provider, set `CreateOidcProvider=false`. The role trusts
   only `repo:<owner>/<repo>:environment:ai-review` with audience `sts.amazonaws.com`. It can only
   call `bedrock:InvokeModel` (which authorizes Converse) on the two global inference profiles, and
   on their models through those profiles.
2. Create a repository environment named `ai-review`.
3. Store the stack's `RoleArn` output in the repository variable `AI_REVIEW_ROLE_ARN`. Until it is
   set, the lanes post a neutral "not configured" check and stop.

## Tests

```shell
python3 -m unittest discover -s .github/ai-review/tests
```
