# Requirements Document

## Introduction

This feature adds a GitHub Actions CI workflow to the aws-samples/aws-smart-product-onboarding repository. The workflow validates pull requests by installing all dependencies (Node.js/pnpm and Python/Poetry), building the NX monorepo, and running `nx run infra:synth` (CDK synth) as the final validation step. The `infra:synth` target transitively depends on building and testing all other packages in the monorepo, making it a comprehensive integration check.

## Glossary

- **CI_Workflow**: The GitHub Actions workflow YAML file that defines the automated continuous integration pipeline triggered on pull requests.
- **Runner**: The GitHub Actions virtual machine environment (Ubuntu) that executes the CI_Workflow jobs.
- **NX**: The monorepo build orchestration tool used to manage dependencies and run targets across workspace packages.
- **Synth_Target**: The NX target `infra:synth` that runs `cdk synth` in the infra package and depends on building all other packages (TypeScript handlers, Python handlers, core-utils, product-categorization, metaclasses, and the infra compile step).
- **pnpm**: The Node.js package manager used by the repository, configured with a workspace via `pnpm-workspace.yaml`.
- **Poetry**: The Python dependency manager used by the Python packages in the monorepo (api, core-utils, metaclasses, product-categorization). Must be version less than 2 due to breaking changes in v2.
- **uv**: A fast Python package manager and project manager that will replace Poetry in the future.
- **Docker**: The container runtime required by CDK synth for bundling Lambda functions and other container-based build steps.
- **Install_CI_Script**: The root `install:ci` npm script that runs `pnpm i --frozen-lockfile` followed by `nx run-many --target=install:ci` to install all workspace dependencies including Python packages.

## Requirements

### Requirement 1: Workflow Trigger on Pull Requests

**User Story:** As a contributor, I want the CI workflow to run automatically when I open or update a pull request, so that I get feedback on whether my changes build and synthesize correctly before merging.

#### Acceptance Criteria

1. WHEN a pull request is opened against the repository, THE CI_Workflow SHALL trigger a workflow run.
2. WHEN a pull request is synchronized (new commits pushed) against the repository, THE CI_Workflow SHALL trigger a workflow run.
3. WHEN a pull request is reopened against the repository, THE CI_Workflow SHALL trigger a workflow run.

### Requirement 2: Node.js and pnpm Setup

**User Story:** As a CI system, I want Node.js and pnpm installed in the Runner environment, so that TypeScript packages can be built and tested.

#### Acceptance Criteria

1. THE CI_Workflow SHALL install Node.js version 22 on the Runner.
2. THE CI_Workflow SHALL install pnpm version 9 on the Runner.
3. THE CI_Workflow SHALL configure pnpm caching to reduce dependency installation time on subsequent runs.

### Requirement 3: Python and Poetry Setup

**User Story:** As a CI system, I want Python 3.13 and Poetry (<2) installed in the Runner environment, so that the Python packages (core-utils, metaclasses, product-categorization, api) can be built and tested.

#### Acceptance Criteria

1. THE CI_Workflow SHALL install Python version 3.13 on the Runner.
2. THE CI_Workflow SHALL install Poetry with a version less than 2 on the Runner.
3. THE CI_Workflow SHALL configure Poetry to create virtual environments within each project directory to enable caching.

### Requirement 4: Dependency Installation

**User Story:** As a CI system, I want all workspace dependencies installed using the repository's install:ci script, so that both Node.js and Python packages are ready for building.

#### Acceptance Criteria

1. THE CI_Workflow SHALL run the Install_CI_Script (`pnpm install:ci`) to install all workspace dependencies.
2. THE CI_Workflow SHALL use a frozen lockfile during pnpm installation to ensure reproducible builds.
3. IF the Install_CI_Script fails, THEN THE CI_Workflow SHALL fail the workflow run and report the error.

### Requirement 5: CDK Synth as Final Validation

**User Story:** As a contributor, I want the CI workflow to run `nx run infra:synth` as the final validation step, so that I know my changes produce a valid CDK CloudFormation template and all transitive dependencies build successfully.

#### Acceptance Criteria

1. THE CI_Workflow SHALL run the Synth_Target (`nx run infra:synth`) after dependency installation completes.
2. WHEN the Synth_Target is executed, THE NX build system SHALL first build all dependent packages (TypeScript handlers, Python handlers, core-utils, product-categorization, metaclasses) before running `cdk synth`.
3. IF the Synth_Target fails, THEN THE CI_Workflow SHALL fail the workflow run and report the error.
4. WHEN the Synth_Target succeeds, THE CI_Workflow SHALL mark the workflow run as successful.

### Requirement 6: Runner Environment

**User Story:** As a repository maintainer, I want the CI workflow to run on a standard GitHub-hosted Ubuntu runner, so that the environment is consistent and maintained without additional infrastructure.

#### Acceptance Criteria

1. THE CI_Workflow SHALL execute all jobs on an `ubuntu-latest` GitHub-hosted Runner.

### Requirement 7: Repository Checkout

**User Story:** As a CI system, I want the workflow to check out the pull request code, so that the build runs against the proposed changes.

#### Acceptance Criteria

1. THE CI_Workflow SHALL check out the full repository source code at the pull request's head commit before any build steps execute.

### Requirement 8: uv Installation

**User Story:** As a repository maintainer, I want uv installed in the Runner environment, so that the project is ready for the planned migration from Poetry to uv as the Python package manager.

#### Acceptance Criteria

1. THE CI_Workflow SHALL install uv on the Runner.
2. THE CI_Workflow SHALL make the uv binary available on the Runner's PATH for use by build steps.

### Requirement 9: Docker Availability

**User Story:** As a CI system, I want Docker available on the Runner, so that CDK synth can bundle Lambda functions and execute container-based build steps.

#### Acceptance Criteria

1. THE CI_Workflow SHALL ensure Docker is available on the Runner before the Synth_Target executes.
2. WHEN the Synth_Target requires Docker for asset bundling, THE Runner SHALL provide a functioning Docker daemon.
