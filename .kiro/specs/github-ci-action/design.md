# Design Document: GitHub CI Action

## Overview

This design defines a GitHub Actions CI workflow for the aws-smart-product-onboarding NX monorepo. The workflow triggers on pull request events (opened, synchronized, reopened) and validates changes by installing all Node.js and Python dependencies, then running `npx nx run @aws-samples/smart-product-onboarding-infra:synth` — which transitively builds and tests every package in the monorepo before synthesizing the CDK CloudFormation template.

The workflow is a single-job pipeline on `ubuntu-latest` with the following high-level step order:

1. Checkout repository
2. Set up Node.js 22 + pnpm 9 (with pnpm store cache)
3. Install Python 3.13 via pyenv (pre-installed on ubuntu-latest)
4. Install Poetry (<2) and uv
5. Configure Poetry for in-project virtualenvs
6. Install all dependencies via `pnpm install:ci`
7. Run `npx nx run @aws-samples/smart-product-onboarding-infra:synth`

Docker is pre-installed on `ubuntu-latest` runners, so no explicit setup step is needed.

## Architecture

The workflow is a single YAML file at `.github/workflows/pr-build.yml` containing one job (`build`). There is no need for multiple jobs or a matrix strategy — the `@aws-samples/smart-product-onboarding-infra:synth` NX target already orchestrates the full dependency graph internally.

```mermaid
flowchart TD
    A[PR Event: opened / synchronize / reopened] --> B[Job: build]
    B --> C[actions/checkout@v4]
    C --> D[pnpm/action-setup@v4 — pnpm 9]
    D --> E[actions/setup-node@v4 — Node 22 + pnpm cache]
    E --> F[pyenv install 3.13 + pyenv global 3.13]
    F --> G[Install Poetry < 2 via pip]
    G --> H[Install uv via astral-sh/setup-uv@v6]
    H --> I[Configure Poetry: virtualenvs.in-project true]
    I --> J[pnpm install:ci]
    J --> K[npx nx run @aws-samples/smart-product-onboarding-infra:synth]
    K --> L{Synth result}
    L -->|Success| M[✓ Workflow passes]
    L -->|Failure| N[✗ Workflow fails]
```

### Key Design Decisions

1. **Single job, not multi-job**: NX handles the build graph. Splitting into separate jobs would require artifact passing between jobs and lose NX's caching benefits. A single job keeps things simple and lets NX parallelize internally.

2. **pnpm store cache via `actions/setup-node`**: The `setup-node` action natively supports pnpm caching when `pnpm/action-setup` runs first. This caches `~/.local/share/pnpm/store/v3` keyed on `pnpm-lock.yaml`.

3. **Python 3.13 via pyenv, not `actions/setup-python`**: The `ubuntu-latest` runner ships with pyenv pre-installed. Using `pyenv install 3.13` and `pyenv global 3.13` gives us the required Python version without a third-party action. Since `actions/setup-python`'s built-in pip cache is not available with this approach, Poetry and uv manage their own dependency caching internally, and pip install of Poetry itself is fast enough to not warrant a separate cache.

4. **Poetry installed via pip, not pipx**: Using `pip install "poetry<2"` in the pyenv-provided Python gives us direct version control and avoids pipx isolation issues with virtualenv paths.

5. **Poetry `virtualenvs.in-project true`**: This places `.venv` directories inside each Python package directory, making them deterministic and cacheable by NX's own caching mechanism.

6. **uv via `astral-sh/setup-uv@v6`**: The official uv action handles installation and PATH setup cleanly. This prepares the repo for the planned Poetry-to-uv migration.

7. **Docker is implicit**: `ubuntu-latest` runners include Docker pre-installed. No explicit setup step is needed — CDK synth will find the Docker daemon automatically.

8. **`install:ci` script handles everything**: The root `pnpm install:ci` script runs `pnpm i --frozen-lockfile` (Node deps) then `nx run-many --target=install:ci` (Python deps via Poetry). One step covers all dependency installation.

## Components and Interfaces

### Workflow File: `.github/workflows/pr-build.yml`

The single deliverable. Structure:

```yaml
name: PR Build
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # 1. Checkout
      # 2. Setup pnpm
      # 3. Setup Node.js (with pnpm cache)
      # 4. Install Python 3.13 via pyenv
      # 5. Install Poetry
      # 6. Setup uv
      # 7. Configure Poetry virtualenvs
      # 8. Install dependencies
      # 9. CDK Synth
```

### Step Details

| Step | Action / Command | Purpose | Req |
|------|-----------------|---------|-----|
| Checkout | `actions/checkout@v4` | Clone PR head commit | 7.1 |
| Setup pnpm | `pnpm/action-setup@v4` with `version: 9` | Install pnpm 9 | 2.2 |
| Setup Node.js | `actions/setup-node@v4` with `node-version: 22`, `cache: pnpm` | Install Node 22, enable pnpm store cache | 2.1, 2.3 |
| Setup Python | `run: pyenv install 3.13 && pyenv global 3.13` | Install Python 3.13 via pre-installed pyenv | 3.1 |
| Install Poetry | `run: pip install "poetry<2"` | Install Poetry <2 | 3.2 |
| Setup uv | `astral-sh/setup-uv@v6` | Install uv, add to PATH | 8.1, 8.2 |
| Configure Poetry | `run: poetry config virtualenvs.in-project true` | In-project venvs for caching | 3.3 |
| Install deps | `run: pnpm install:ci` | Frozen lockfile install + Python deps | 4.1, 4.2, 4.3 |
| CDK Synth | `run: npx nx run @aws-samples/smart-product-onboarding-infra:synth` | Build all packages + synthesize CDK template | 5.1, 5.2, 5.3, 5.4 |

### External Actions Used

- `actions/checkout@v4` — standard repo checkout
- `pnpm/action-setup@v4` — official pnpm installer
- `actions/setup-node@v4` — Node.js setup with built-in pnpm cache support
- `astral-sh/setup-uv@v6` — official uv installer

Note: Python 3.13 is installed via pyenv (pre-installed on `ubuntu-latest`), not via `actions/setup-python`.

### Caching Strategy

| What | Mechanism | Cache Key |
|------|-----------|-----------|
| pnpm store | `actions/setup-node` `cache: pnpm` | Hash of `pnpm-lock.yaml` |
| Poetry venvs | In-project `.venv` dirs (NX-managed) | NX computation hash |

Note: Since Python is installed via pyenv rather than `actions/setup-python`, the built-in pip cache from that action is not available. Poetry and uv handle their own dependency resolution efficiently, and the `pip install "poetry<2"` step is lightweight enough that a dedicated cache is unnecessary.

## Data Models

This feature produces a single YAML configuration file. There are no runtime data models, database schemas, or API contracts. The "data model" is the workflow YAML schema defined by GitHub Actions.

### Workflow YAML Schema (key fields)

```yaml
# Top-level
name: string                    # Workflow display name
on:
  pull_request:
    types: string[]             # Event types: opened, synchronize, reopened

# Job definition
jobs:
  build:
    runs-on: string             # Runner label: ubuntu-latest
    steps:
      - uses: string            # Action reference (owner/repo@version)
        with: object            # Action inputs
      - name: string            # Step display name
        run: string             # Shell command
```

### NX Dependency Graph (for reference)

The `@aws-samples/smart-product-onboarding-infra:synth` target depends on building these packages in order:

```mermaid
flowchart BT
    A[core-utils] --> B[product-categorization]
    A --> C[metaclasses]
    D[api-python-runtime] --> E[api-python-handlers]
    D --> C
    A --> E
    F[api-typescript-handlers] --> G[infra:compile]
    E --> G
    A --> G
    B --> G
    C --> G
    G --> H[@aws-samples/smart-product-onboarding-infra:synth]
```

NX resolves this graph automatically when `@aws-samples/smart-product-onboarding-infra:synth` is invoked — the CI workflow just needs to call the single synth target.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Most acceptance criteria for this feature are concrete structural checks on a static YAML file (examples, not properties). However, three properties emerge from the requirements that apply universally:

### Property 1: Step ordering invariant

*For any* valid PR build workflow, the step indices must satisfy: checkout < tool-setup steps < dependency-install step < synth step. That is, repository checkout must come first, all tool setup (Node, pnpm, Python, Poetry, uv) must complete before dependency installation, and dependency installation must complete before CDK synth.

**Validates: Requirements 5.1, 7.1**

### Property 2: Workflow YAML round-trip validity

*For any* workflow YAML file produced by this feature, parsing the file as YAML and re-serializing it should produce an equivalent structure with no parse errors. The file must be syntactically valid YAML conforming to the GitHub Actions workflow schema.

**Validates: Requirements 1.1, 1.2, 1.3, 6.1**

### Property 3: No silent failure on critical steps

*For all* steps in the workflow that run build or install commands (dependency installation, CDK synth), none shall have `continue-on-error: true` set, ensuring that any non-zero exit code propagates as a workflow failure.

**Validates: Requirements 4.3, 5.3**

## Error Handling

### Step Failure Propagation

GitHub Actions fails a job when any step exits with a non-zero code (default behavior). The workflow relies on this default — no `continue-on-error` is set on any step. This means:

- If `pnpm install:ci` fails (e.g., lockfile mismatch, network error, Poetry install failure), the job fails immediately and subsequent steps are skipped.
- If `npx nx run @aws-samples/smart-product-onboarding-infra:synth` fails (e.g., TypeScript compilation error, Python test failure, CDK synth error), the job fails and the PR check is marked as failed.

### Specific Failure Scenarios

| Scenario | Cause | Behavior |
|----------|-------|----------|
| Lockfile mismatch | `pnpm-lock.yaml` out of sync with `package.json` | `--frozen-lockfile` causes pnpm to exit non-zero |
| Poetry lock mismatch | `poetry.lock` out of sync with `pyproject.toml` | `poetry check --lock` in install:ci fails |
| TypeScript build error | Compilation failure in any TS package | NX stops and reports the error |
| Python test failure | pytest failure in any Python package | NX stops and reports the error |
| CDK synth error | Invalid CDK constructs or missing context | `cdk synth` exits non-zero |
| Docker unavailable | Unlikely on ubuntu-latest, but possible | CDK synth fails during asset bundling |
| Action version unavailable | Pinned action version removed from marketplace | Workflow fails at step setup |
| pyenv install failure | Python 3.13 not available in pyenv registry | pyenv exits non-zero, workflow fails |

### No Retry Strategy

The workflow does not implement retries. Transient failures (network issues during dependency download) are expected to be handled by re-running the workflow manually via the GitHub UI. This keeps the workflow simple and avoids masking real failures.

## Testing Strategy

### Dual Testing Approach

This feature produces a single YAML file, so testing focuses on structural validation of that file rather than runtime behavior.

#### Unit Tests (Example-Based)

Unit tests parse the generated `pr-build.yml` and verify specific structural expectations. These are implemented using a YAML parser in the project's test framework.

Specific examples to test:
- PR trigger includes `opened`, `synchronize`, `reopened` event types (Req 1.1–1.3)
- Job runs on `ubuntu-latest` (Req 6.1)
- `actions/checkout@v4` is the first step (Req 7.1)
- `actions/setup-node@v4` configured with `node-version: '22'` and `cache: pnpm` (Req 2.1, 2.3)
- `pnpm/action-setup@v4` configured with `version: '9'` (Req 2.2)
- A step runs `pyenv install 3.13` and `pyenv global 3.13` to set up Python 3.13 (Req 3.1)
- A step runs `pip install "poetry<2"` (Req 3.2)
- A step runs `poetry config virtualenvs.in-project true` (Req 3.3)
- `astral-sh/setup-uv@v6` is present (Req 8.1, 8.2)
- A step runs `pnpm install:ci` (Req 4.1, 4.2)
- A step runs `npx nx run @aws-samples/smart-product-onboarding-infra:synth` (Req 5.1)

#### Property-Based Tests

Property-based tests validate universal invariants using a PBT library. Each test should run a minimum of 100 iterations.

- **Feature: github-ci-action, Property 1: Step ordering invariant** — Generate random permutations of step names and verify that only orderings matching checkout → setup → install → synth are accepted by a validation function.
- **Feature: github-ci-action, Property 2: Workflow YAML round-trip validity** — Generate random valid workflow modifications (adding env vars, extra echo steps) and verify the YAML always parses back correctly.
- **Feature: github-ci-action, Property 3: No silent failure on critical steps** — Generate workflow variants with random `continue-on-error` settings and verify the validation function rejects any variant where critical steps have `continue-on-error: true`.

#### Testing Library

Since the monorepo uses Jest for TypeScript packages and pytest for Python packages, workflow YAML validation tests should use Jest with the `js-yaml` package for YAML parsing. For property-based testing, use `fast-check` as the PBT library (it integrates natively with Jest).

Each property-based test must be tagged with a comment:
```
// Feature: github-ci-action, Property {number}: {property_text}
```

### What Not to Test

- NX dependency graph resolution (tested by NX itself)
- Docker availability on ubuntu-latest (GitHub's responsibility)
- Actual GitHub Actions execution (requires a real PR — integration testing)
- CDK synth output correctness (tested by the infra package's own tests)
