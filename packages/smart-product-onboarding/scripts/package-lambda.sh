#!/bin/bash

# Lambda packaging script for uv workspace packages
# Usage: ./scripts/package-lambda.sh [output-dir]
# Run from within the package directory you want to package
#
# Environment variables:
#   PYTHON_VERSION - Python version for Lambda (default: 3.13)
#   PLATFORM - Target platform (default: aarch64-unknown-linux-gnu)
#
# Examples:
#   ./scripts/package-lambda.sh
#   PYTHON_VERSION=3.12 ./scripts/package-lambda.sh
#   PLATFORM=x86_64-unknown-linux-gnu ./scripts/package-lambda.sh dist/x86-lambda

set -e

OUTPUT_DIR=${1:-"dist/lambda"}
PYTHON_VERSION=${PYTHON_VERSION:-"3.13"}
PLATFORM=${PLATFORM:-"aarch64-unknown-linux-gnu"}

# Get package name from current directory's pyproject.toml
if [[ ! -f "pyproject.toml" ]]; then
    echo "Error: No pyproject.toml found in current directory"
    echo "Please run this script from within a Python package directory"
    exit 1
fi

PACKAGE_NAME=$(grep '^name = ' pyproject.toml | sed 's/name = "\(.*\)"/\1/' | tr -d '"')
if [[ -z "$PACKAGE_NAME" ]]; then
    echo "Error: Could not determine package name from pyproject.toml"
    exit 1
fi

echo "Packaging Lambda function for package: $PACKAGE_NAME"
echo "Output directory: $OUTPUT_DIR"
echo "Python version: $PYTHON_VERSION"
echo "Platform: $PLATFORM"
echo "Working directory: $(pwd)"

# Find workspace root by looking for pyproject.toml with [tool.uv.workspace]
WORKSPACE_ROOT=""
CURRENT_DIR=$(pwd)
while [[ "$CURRENT_DIR" != "/" ]]; do
    if [[ -f "$CURRENT_DIR/pyproject.toml" ]] && grep -q "\[tool\.uv\.workspace\]" "$CURRENT_DIR/pyproject.toml" 2>/dev/null; then
        WORKSPACE_ROOT="$CURRENT_DIR"
        break
    fi
    CURRENT_DIR=$(dirname "$CURRENT_DIR")
done

if [[ -z "$WORKSPACE_ROOT" ]]; then
    echo "Error: Could not find workspace root with pyproject.toml containing [tool.uv.workspace]"
    exit 1
fi

echo "Workspace root: $WORKSPACE_ROOT"

# Clean and create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# Step 1: Export external requirements (without workspace packages)
echo "Step 1: Exporting external requirements..."
uv export \
    --no-emit-workspace \
    --frozen \
    --no-dev \
    --no-editable \
    -o "$OUTPUT_DIR/requirements.txt"

# Show what we're installing
cat "$OUTPUT_DIR/requirements.txt"

# Step 2: Install external dependencies
echo "Step 2: Installing external dependencies..."
uv pip install \
    --no-installer-metadata \
    --compile-bytecode \
    --target "$OUTPUT_DIR" \
    --python-platform "$PLATFORM" \
    --python-version "$PYTHON_VERSION" \
    -r "$OUTPUT_DIR/requirements.txt"

# Step 3: Install current package
echo "Step 3: Installing current package..."
uv pip install \
    --no-installer-metadata \
    --compile-bytecode \
    --target "$OUTPUT_DIR" \
    --python-platform "$PLATFORM" \
    --python-version "$PYTHON_VERSION" \
    .

# Step 4: Install workspace dependencies
echo "Step 4: Installing workspace dependencies..."
# Get all dependencies including workspace ones
uv export --frozen --no-dev --no-editable -o "$OUTPUT_DIR/all_requirements.txt" 2>/dev/null || true
if [ -f "$OUTPUT_DIR/all_requirements.txt" ]; then
    # Find workspace dependencies (local paths starting with ./)
    WORKSPACE_DEPS=$(grep "^\./" "$OUTPUT_DIR/all_requirements.txt" | cut -d' ' -f1 || true)
    
    if [ -n "$WORKSPACE_DEPS" ]; then
        echo "Found workspace dependencies:"
        echo "$WORKSPACE_DEPS"
        
        # Get current package relative path from workspace root
        CURRENT_ABS_PATH=$(pwd)
        CURRENT_REL_PATH="${CURRENT_ABS_PATH#$WORKSPACE_ROOT/}"
        
        # Install each workspace dependency
        while IFS= read -r dep_path; do
            if [ -n "$dep_path" ]; then
                # Skip current package (already installed in step 3)
                if [ "$dep_path" = "./$CURRENT_REL_PATH" ]; then
                    echo "Skipping current package: $dep_path"
                    continue
                fi
                
                # Convert relative path to absolute path from workspace root
                # Remove the leading "./" from dep_path first
                CLEAN_DEP_PATH="${dep_path#./}"
                ABS_DEP_PATH="$WORKSPACE_ROOT/$CLEAN_DEP_PATH"
                
                echo "Installing workspace dependency: $dep_path -> $ABS_DEP_PATH"
                uv pip install \
                    --no-installer-metadata \
                    --compile-bytecode \
                    --target "$OUTPUT_DIR" \
                    --python-platform "$PLATFORM" \
                    --python-version "$PYTHON_VERSION" \
                    "$ABS_DEP_PATH"
            fi
        done <<< "$WORKSPACE_DEPS"
    else
        echo "No workspace dependencies found"
    fi
    
    rm -f "$OUTPUT_DIR/all_requirements.txt"
fi

# Clean up requirements.txt
rm -f "$OUTPUT_DIR/requirements.txt"

echo "Lambda package created successfully in $OUTPUT_DIR"
echo "Package size: $(du -sh "$OUTPUT_DIR" | cut -f1)"
echo "Package contents:"
find "$OUTPUT_DIR" -maxdepth 2 -type d | head -20