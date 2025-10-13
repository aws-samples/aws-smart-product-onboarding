# Projen Ejection Analysis

## Overview

The projen eject command has successfully generated scripts directories in all packages. This document analyzes the generated scripts and identifies which tasks need to be converted to Nx targets.

## Generated Scripts Directories

The following scripts directories were created:

### Root Level

- `scripts/run-task` - Root level task runner

### Package Level Scripts

- `packages/api/scripts/run-task`
- `packages/api/model/scripts/run-task`
- `packages/api/generated/documentation/markdown/scripts/run-task`
- `packages/api/generated/infrastructure/typescript/scripts/run-task`
- `packages/api/generated/libraries/typescript-react-query-hooks/scripts/run-task`
- `packages/api/generated/runtime/python/scripts/run-task`
- `packages/api/generated/runtime/typescript/scripts/run-task`
- `packages/api/handlers/python/scripts/run-task`
- `packages/api/handlers/typescript/scripts/run-task`
- `packages/infra/scripts/run-task`
- `packages/website/scripts/run-task`
- `packages/smart-product-onboarding/core-utils/scripts/run-task`
- `packages/smart-product-onboarding/metaclasses/scripts/run-task`
- `packages/smart-product-onboarding/product-categorization/scripts/run-task`

## Task Analysis by Package Type

### Infrastructure Package (packages/infra)

**Tasks to convert to Nx targets:**

- `build` - Full release build pipeline
- `compile` - TypeScript compilation
- `test` - Jest tests + ESLint
- `eslint` - Code linting
- `deploy` - CDK deployment
- `deploy:dev` - Hot-swap deployment
- `destroy` - CDK destroy
- `diff` - CDK diff
- `synth` - CDK synthesis
- `watch` - CDK watch mode
- `package` - Distribution package creation

**Environment variables:**

- `PATH` - Modified for pnpm

### Website Package (packages/website)

**Tasks to convert to Nx targets:**

- `build` - Full release build pipeline
- `compile` - React build via react-scripts
- `dev` - Development server
- `test` - React tests + ESLint
- `eslint` - Code linting
- `pre-compile` - API spec copying
- `package` - Distribution package creation
- `watch` - TypeScript watch mode

**Environment variables:**

- `DISABLE_ESLINT_PLUGIN` - Set to "true"
- `ESLINT_NO_DEV_ERRORS` - Set to "true" for dev
- `TSC_COMPILE_ON_ERROR` - Set to "true" for dev

### TypeScript Handler Package (packages/api/handlers/typescript)

**Tasks to convert to Nx targets:**

- `build` - Full release build pipeline
- `compile` - TypeScript compilation
- `test` - Jest tests + ESLint
- `eslint` - Code linting
- `generate` - Type-safe API generation
- `package` - Lambda packaging with esbuild
- `pre-compile` - API generation step
- `watch` - TypeScript watch mode

**Environment variables:**

- `AWS_PDK_VERSION` - Set to "0.26.7"

### Python Packages (core-utils, metaclasses, product-categorization)

**Tasks to convert to Nx targets:**

- `build` - Full release build pipeline
- `compile` - Python compilation (mostly no-op)
- `test` - pytest execution
- `package` - Poetry build
- `install` - Poetry dependency installation
- `install:ci` - CI dependency installation
- `publish` - PyPI publishing
- `publish:test` - Test PyPI publishing

**Environment variables:**

- `PYTHON_VERSION` - Dynamic Python version detection
- `VIRTUAL_ENV` - Poetry virtual environment
- `PATH` - Modified for poetry environment

### Generated API Packages

**Tasks to convert to Nx targets:**

- `build` - Full release build pipeline
- `compile` - TypeScript/Python compilation
- `test` - Testing (where applicable)
- `package` - Package creation
- `generate` - Code generation from OpenAPI spec

## Key Conversion Requirements

### 1. Task Dependencies

- Most packages follow the pattern: `pre-compile` → `compile` → `post-compile` → `test` → `package`
- Nx targets need to maintain these dependencies

### 2. Environment Variables

- Each package has specific environment variables that need to be preserved
- Python packages require dynamic environment setup

### 3. Cross-Package Dependencies

- Website depends on API model for spec copying
- Generated packages depend on model changes
- Infrastructure depends on all packages for deployment

### 4. Special Commands

- CDK-specific commands (deploy, destroy, diff, synth, watch)
- Poetry-specific commands for Python packages
- React-specific commands for website
- esbuild packaging for Lambda functions

## Scripts That Need Nx Target Conversion

### High Priority (Core Development Tasks)

1. `build` - All packages
2. `test` - All packages
3. `compile` - All packages
4. `eslint` - TypeScript packages
5. `dev` - Website package
6. `package` - All packages

### Medium Priority (Development Workflow)

1. `watch` - All packages
2. `pre-compile` - Packages with generation steps
3. `post-compile` - Packages with post-build steps
4. `generate` - API packages

### Low Priority (Deployment/Publishing)

1. `deploy` - Infrastructure package
2. `destroy` - Infrastructure package
3. `publish` - Python packages
4. `synth` - Infrastructure package
5. `diff` - Infrastructure package

## Nx Target Structure Recommendations

### Standard Targets for All Packages

- `build` - Full build pipeline
- `test` - Run tests
- `lint` - Code linting (where applicable)
- `package` - Create distribution package

### Package-Specific Targets

- **Infrastructure**: `deploy`, `destroy`, `synth`, `diff`, `watch`
- **Website**: `dev`, `serve`
- **Python**: `publish`, `publish:test`
- **API**: `generate`

### Shared Targets

- `install` - Dependency installation
- `install:ci` - CI dependency installation
- `upgrade` - Dependency upgrades

## Next Steps

1. Convert high-priority tasks to Nx targets
2. Test each converted target
3. Update package.json scripts to use Nx
4. Remove generated scripts directories
5. Update CI/CD pipelines to use Nx commands
