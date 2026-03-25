# Implementation Plan: GitHub CI Action

## Overview

Create a GitHub Actions CI workflow for the aws-smart-product-onboarding monorepo that validates pull requests by installing all dependencies and running CDK synth. The real validation is pushing a PR and watching the build run.

## Tasks

- [x] 1. Create the PR build workflow file
  - [x] 1.1 Create `.github/workflows/pr-build.yml` with trigger configuration
    - Create the workflow file at `cloned-repos/aws-smart-product-onboarding/.github/workflows/pr-build.yml`
    - Set `name: PR Build`
    - Configure `on.pull_request.types` with `opened`, `synchronize`, `reopened`
    - Define `jobs.build` with `runs-on: ubuntu-latest`
    - _Requirements: 1.1, 1.2, 1.3, 6.1_

  - [x] 1.2 Add checkout and Node.js/pnpm setup steps
    - Add `actions/checkout@v4` as the first step
    - Add `pnpm/action-setup@v4` with `version: '9'`
    - Add `actions/setup-node@v4` with `node-version: '22'` and `cache: pnpm`
    - _Requirements: 7.1, 2.1, 2.2, 2.3_

  - [x] 1.3 Add Python, Poetry, and uv setup steps
    - Add a step running `pyenv install 3.13 && pyenv global 3.13` for Python 3.13
    - Add a step running `pip install "poetry<2"` for Poetry
    - Add `astral-sh/setup-uv@v6` for uv installation
    - Add a step running `poetry config virtualenvs.in-project true`
    - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2_

  - [x] 1.4 Add dependency installation and CDK synth steps
    - Add a step running `pnpm install:ci` for all workspace dependencies
    - Add a step running `npx nx run @aws-samples/smart-product-onboarding-infra:synth` as the final step
    - Ensure no step has `continue-on-error: true`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 9.1, 9.2_

- [x] 2. Checkpoint - Verify workflow file
  - Ensure the workflow YAML is syntactically valid and all steps are in the correct order, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- The workflow file lives at `cloned-repos/aws-smart-product-onboarding/.github/workflows/pr-build.yml`
- Docker is pre-installed on `ubuntu-latest` so no explicit setup step is needed (Requirements 9.1, 9.2)
- The real test is pushing a PR and running the workflow on GitHub Actions
