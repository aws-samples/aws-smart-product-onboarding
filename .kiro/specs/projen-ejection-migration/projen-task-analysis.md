# Projen Task Structure Analysis

## Overview

This document provides a comprehensive analysis of the current Projen task structure across all packages in the Smart Product Onboarding monorepo. This analysis is required for the migration from Projen/PDK management to direct pnpm + Nx management.

## Package Inventory

### Root Workspace

- **Location**: `.projen/tasks.json`
- **Type**: Monorepo orchestration
- **Key Tasks**: build, compile, test, eslint, package, install:ci, postinstall, upgrade-deps

### TypeScript Packages

#### 1. API Model Package

- **Location**: `packages/api/model/.projen/tasks.json`
- **Type**: OpenAPI specification processing
- **Key Tasks**: generate (OpenAPI parsing), build, compile, test, package

#### 2. API TypeScript Handlers

- **Location**: `packages/api/handlers/typescript/.projen/tasks.json`
- **Type**: Lambda handlers with code generation
- **Key Tasks**: generate (TypeSafe API), compile (tsc), package (esbuild + Lambda packaging), test (Jest), eslint

#### 3. API TypeScript Runtime (Generated)

- **Location**: `packages/api/generated/runtime/typescript/.projen/tasks.json`
- **Type**: Generated TypeScript client library
- **Key Tasks**: generate (TypeSafe API), compile (tsc), package (pnpm pack), watch

#### 4. API TypeScript Infrastructure (Generated)

- **Location**: `packages/api/generated/infrastructure/typescript/.projen/tasks.json`
- **Type**: Generated CDK constructs
- **Key Tasks**: generate (TypeSafe API + mock data), compile (tsc), package (pnpm pack)

#### 5. React Query Hooks (Generated)

- **Location**: `packages/api/generated/libraries/typescript-react-query-hooks/.projen/tasks.json`
- **Type**: Generated React hooks for API
- **Key Tasks**: generate (TypeSafe API), compile (tsc), package (pnpm pack), watch

#### 6. Website Package

- **Location**: `packages/website/.projen/tasks.json`
- **Type**: React application
- **Key Tasks**: compile (react-scripts build), dev (react-scripts start), test (react-scripts test + eslint), pre-compile (API spec copying)

#### 7. Infrastructure Package

- **Location**: `packages/infra/.projen/tasks.json`
- **Type**: CDK application
- **Key Tasks**: synth, deploy, destroy, diff, watch, test (Jest), eslint, post-compile (synth:silent)

#### 8. API Parent Package

- **Location**: `packages/api/.projen/tasks.json`
- **Type**: Orchestration package (no actual tasks)
- **Key Tasks**: build, compile, test, package (all empty)

### Python Packages

#### 1. Core Utils

- **Location**: `packages/smart-product-onboarding/core-utils/.projen/tasks.json`
- **Type**: Shared Python utilities
- **Key Tasks**: install (Poetry), install:ci, package (poetry build), test (pytest), publish

#### 2. Product Categorization

- **Location**: `packages/smart-product-onboarding/product-categorization/.projen/tasks.json`
- **Type**: AI categorization logic
- **Key Tasks**: install (Poetry), install:ci, package (poetry build), test (pytest), publish

#### 3. Metaclasses

- **Location**: `packages/smart-product-onboarding/metaclasses/.projen/tasks.json`
- **Type**: Vector processing with FAISS
- **Key Tasks**: install (Poetry), install:ci, package (poetry build), test (pytest), publish

#### 4. API Python Handlers

- **Location**: `packages/api/handlers/python/.projen/tasks.json`
- **Type**: Lambda handlers with code generation
- **Key Tasks**: generate (TypeSafe API), install (Poetry), package (poetry build + Lambda packaging), test (pytest)

#### 5. API Python Runtime (Generated)

- **Location**: `packages/api/generated/runtime/python/.projen/tasks.json`
- **Type**: Generated Python client library
- **Key Tasks**: generate (TypeSafe API), install (Poetry), package (poetry build + rsync to smart-product-onboarding/api)

### Documentation Package

#### API Documentation (Generated)

- **Location**: `packages/api/generated/documentation/markdown/.projen/tasks.json`
- **Type**: Generated API documentation
- **Key Tasks**: generate (TypeSafe API docs), compile (generate)

## Task Dependency Analysis

### Root Level Dependencies

```
Root Tasks → Nx run-many → Package-specific tasks
├── build → compile → test → package
├── install:ci → Python package installs (sequential)
├── postinstall → Python package installs (parallel=1)
└── upgrade-deps → Python upgrades + installs
```

### TypeScript Package Dependencies

```
Standard TypeScript Build Flow:
pre-compile → compile → post-compile → test → package

Specific Dependencies:
- API Model: generate → (used by other packages)
- Handlers: generate → compile (tsc) → package (esbuild + Lambda)
- Generated packages: generate → compile (tsc) → package (pnpm pack)
- Website: pre-compile (copy API spec) → compile (react-scripts)
- Infra: post-compile (synth:silent) → depends on all Lambda builds
```

### Python Package Dependencies

```
Standard Python Build Flow:
install → compile → test → package

Specific Dependencies:
- Core Utils → (dependency of other Python packages)
- API Runtime → package (rsync to smart-product-onboarding/api)
- Handlers: generate → install → package (Lambda packaging)
```

## Custom Build Logic Requiring Preservation

### 1. TypeSafe API Code Generation

- **Location**: Multiple packages with `generate` tasks
- **Logic**: Uses AWS PDK TypeSafe API to generate code from OpenAPI spec
- **Dependencies**: Requires `AWS_PDK_VERSION` environment variable
- **Critical**: All generated packages depend on this

### 2. Lambda Packaging Logic

- **TypeScript Handlers**: esbuild bundling + directory restructuring + template copying
- **Python Handlers**: Poetry export + pip install with specific platform targeting
- **Critical**: Required for CDK deployment

### 3. API Spec Processing

- **Model Package**: OpenAPI spec parsing to `.api.json`
- **Website**: Copying API spec to public directory for runtime use
- **Critical**: All generated packages depend on the parsed spec

### 4. Python Runtime Distribution

- **Runtime Package**: rsync to `smart-product-onboarding/api` directory
- **Logic**: Copies generated Python runtime to be used by other Python packages
- **Critical**: Required for Python package dependencies

### 5. CDK Synthesis Integration

- **Infra Package**: `post-compile` runs `synth:silent`
- **Logic**: Automatically synthesizes CDK after compilation
- **Dependencies**: Must depend on all Lambda package builds

### 6. Poetry Environment Management

- **All Python Packages**: Complex Poetry environment setup with pyenv integration
- **Logic**: Automatic Python version detection and virtual environment management
- **Environment Variables**: `VIRTUAL_ENV`, `PATH`, `PYTHON_VERSION`

### 7. Template Copying for Handlers

- **TypeScript Handlers**: Copies `src/templates` to Lambda distribution
- **Logic**: Preserves Jinja2 templates used by Lambda functions
- **Critical**: Required for product generation functionality

## High-Level Build Process Steps

### 1. Initial Setup

```bash
pnpm i                           # Install TypeScript dependencies
pnpm pdk install:ci             # Install Python dependencies sequentially
```

### 2. Code Generation Phase

```bash
# API Model generates .api.json from OpenAPI spec
packages/api/model: generate

# All generated packages regenerate from .api.json
packages/api/generated/*/: generate
packages/api/handlers/*/: generate
```

### 3. Compilation Phase

```bash
# TypeScript packages compile
packages/*/: compile (tsc or react-scripts)

# Python packages have no compilation step
```

### 4. Testing Phase

```bash
# All packages run tests
packages/*/: test (Jest, pytest, or react-scripts test)
```

### 5. Packaging Phase

```bash
# TypeScript packages create distributions
packages/api/handlers/typescript: esbuild + Lambda packaging
packages/api/generated/*/: pnpm pack
packages/website: react-scripts build

# Python packages create wheels and Lambda distributions
packages/smart-product-onboarding/*/: poetry build
packages/api/handlers/python: poetry build + Lambda packaging
packages/api/generated/runtime/python: poetry build + rsync
```

### 6. Infrastructure Phase

```bash
# CDK synthesis (depends on all Lambda packages)
packages/infra: synth

# CDK deployment
packages/infra: deploy
```

## Environment Variables and Configuration

### Global Environment

- `PATH`: Enhanced with pnpm and Poetry paths
- `AWS_PDK_VERSION`: "0.26.7" (used by all TypeSafe API generation)

### Python-Specific Environment

- `VIRTUAL_ENV`: Poetry virtual environment path
- `PYTHON_VERSION`: Auto-detected from pyenv
- `PATH`: Enhanced with Poetry virtual environment bin directory

### Build-Specific Environment

- `CI`: Set to "0" during upgrade tasks
- `PROJEN_EJECTING`: Set to "true" during ejection
- `DISABLE_ESLINT_PLUGIN`: Set to "true" for website
- `ESLINT_NO_DEV_ERRORS`: Set to "true" for website dev mode
- `TSC_COMPILE_ON_ERROR`: Set to "true" for website dev mode

## Critical Nx Target Mappings Required

### Root Level Targets

- `build` → `nx run-many --target=build`
- `test` → `nx run-many --target=test`
- `install:ci` → Sequential Python package installation
- `postinstall` → Parallel Python package installation

### TypeScript Package Targets

- `generate` → TypeSafe API code generation
- `compile` → TypeScript compilation or React build
- `package` → Distribution creation (esbuild, pnpm pack, etc.)
- `eslint` → ESLint execution
- `watch` → Development mode compilation

### Python Package Targets

- `install` → Poetry dependency installation
- `package` → Poetry build + Lambda packaging (where applicable)
- `test` → pytest execution

### CDK Package Targets

- `synth` → CDK synthesis (depends on Lambda builds)
- `deploy` → CDK deployment
- `destroy` → CDK stack destruction
- `diff` → CDK diff generation
- `watch` → CDK watch mode

## Conclusion

The current Projen setup orchestrates a complex build system with:

- 13 packages with individual task definitions
- Multiple code generation steps using TypeSafe API
- Complex Lambda packaging for both TypeScript and Python
- Intricate dependency relationships between packages
- Environment-specific configuration for Poetry and pnpm

The migration to direct Nx management must preserve all this functionality while removing the Projen abstraction layer.
