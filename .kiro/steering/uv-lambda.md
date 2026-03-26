# Packaging AWS Lambda Functions with uv Workspaces

## Overview

Packaging AWS Lambda functions from uv workspaces requires careful handling of workspace dependencies to ensure proper deployment. The key challenge is that workspace packages are installed as editable references by default, which doesn't work for Lambda deployment where all code must be bundled.

## Core Principles

### 1. Export Non-Editable Requirements
Use `uv export` with specific flags to generate a requirements.txt without workspace references:

```bash
uv export --no-emit-workspace --frozen --no-dev --no-editable -o requirements.txt
```

- `--no-emit-workspace`: Excludes workspace packages from requirements.txt
- `--frozen`: Uses exact versions from lockfile
- `--no-dev`: Excludes development dependencies
- `--no-editable`: Forces non-editable installations

### 2. Target Correct Runtime and Architecture
Lambda requires specific Python platform targeting:

```bash
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  -r requirements.txt
```

**Key Parameters:**
- `--python-platform aarch64-unknown-linux-gnu`: For ARM64 Lambda (Graviton2)
- `--python-version 3.13`: Match your Lambda runtime version
- `--target lambda_package`: Install to specific directory
- `--compile-bytecode`: Pre-compile for faster cold starts
- `--no-installer-metadata`: Reduce package size

**Alternative Platforms:**
- `x86_64-unknown-linux-gnu`: For x86_64 Lambda
- `--python-version 3.12`: For Python 3.12 runtime
- `--python-version 3.11`: For Python 3.11 runtime

### 3. Install Workspace Dependencies Separately
After installing external dependencies, install workspace packages explicitly:

```bash
# Install current package
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  .

# Install workspace dependencies
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  ../shared-package
```

## Complete Packaging Process

### 1. Setup Build Directory
```bash
rm -rf dist/lambda/function-name
mkdir -p dist/lambda/function-name/lambda_package
```

### 2. Export Requirements
```bash
uv export --no-emit-workspace --frozen --no-dev --no-editable -o dist/lambda/function-name/requirements.txt
```

### 3. Install Dependencies
```bash
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target dist/lambda/function-name/lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  -r dist/lambda/function-name/requirements.txt
```

### 4. Install Current Package
```bash
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target dist/lambda/function-name/lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  .
```

### 5. Install Workspace Dependencies
```bash
uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target dist/lambda/function-name/lambda_package \
  --python-platform aarch64-unknown-linux-gnu \
  --python-version 3.13 \
  ../workspace-dependency
```

### 6. Create Deployment Package
```bash
cd dist/lambda/function-name/lambda_package
zip -r ../lambda.zip .
cd .. && rm -rf lambda_package
```

## Workspace Configuration

### pyproject.toml Structure
```toml
[project]
name = "lambda-function"
dependencies = [
    "boto3>=1.37.31",
    "shared-package",  # Workspace dependency
]

[tool.uv.sources]
shared-package = { workspace = true }
```

### Workspace Root
```toml
[tool.uv.workspace]
members = [
    "lambda-function",
    "shared-package"
]
```

## Runtime Considerations

### Python Version Alignment
- Lambda runtime version must match `--python-version`
- Use `python3.13` runtime for `--python-version 3.13`
- Use `python3.12` runtime for `--python-version 3.12`

### Architecture Selection
- ARM64 (Graviton2): `aarch64-unknown-linux-gnu` - Better price/performance
- x86_64: `x86_64-unknown-linux-gnu` - Broader compatibility

### Package Size Optimization
- Use `--compile-bytecode` for faster imports
- Use `--no-installer-metadata` to reduce size
- Exclude development dependencies with `--no-dev`

## Common Issues

### Editable Installation Problem
**Symptom:** Lambda fails with import errors for workspace packages
**Solution:** Use `--no-editable` in export and install workspace packages separately

### Platform Mismatch
**Symptom:** Binary dependencies fail to load in Lambda
**Solution:** Ensure `--python-platform` matches Lambda architecture

### Version Conflicts
**Symptom:** Dependency resolution errors during packaging
**Solution:** Use `--frozen` to lock exact versions from workspace

## Automation Example

```bash
#!/bin/bash
FUNCTION_NAME="my-lambda"
PYTHON_VERSION="3.13"
PLATFORM="aarch64-unknown-linux-gnu"
WORKSPACE_DEPS="../shared-package"

# Setup
rm -rf dist/lambda/$FUNCTION_NAME
mkdir -p dist/lambda/$FUNCTION_NAME/lambda_package

# Export and install
uv export --no-emit-workspace --frozen --no-dev --no-editable -o dist/lambda/$FUNCTION_NAME/requirements.txt

uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target dist/lambda/$FUNCTION_NAME/lambda_package \
  --python-platform $PLATFORM \
  --python-version $PYTHON_VERSION \
  -r dist/lambda/$FUNCTION_NAME/requirements.txt

uv pip install \
  --no-installer-metadata \
  --compile-bytecode \
  --target dist/lambda/$FUNCTION_NAME/lambda_package \
  --python-platform $PLATFORM \
  --python-version $PYTHON_VERSION \
  .

for dep in $WORKSPACE_DEPS; do
  uv pip install \
    --no-installer-metadata \
    --compile-bytecode \
    --target dist/lambda/$FUNCTION_NAME/lambda_package \
    --python-platform $PLATFORM \
    --python-version $PYTHON_VERSION \
    $dep
done

# Package
cd dist/lambda/$FUNCTION_NAME/lambda_package
zip -r ../lambda.zip .
cd .. && rm -rf lambda_package
```

This approach ensures reliable Lambda packaging with proper dependency resolution and platform targeting.
