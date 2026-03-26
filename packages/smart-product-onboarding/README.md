# Smart Product Onboarding - UV Workspace

This is the UV workspace root for all Python packages in the Smart Product Onboarding project.

## Workspace Structure

This workspace contains the following packages:

- **api/runtime** - Generated API runtime code from OpenAPI specification
- **api/handlers** - Lambda function handlers for API endpoints
- **core-utils** - Shared utilities and base classes
- **metaclasses** - Word vector processing and metaclass generation
- **product-categorization** - Bottom-up product categorization logic

## Development Setup

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager

### Installation

```bash
# Install all workspace dependencies
uv sync

# Install specific package dependencies
uv sync --package amzn-smart-product-onboarding-core-utils
```

### Development Commands

```bash
# Run tests for all packages
uv run pytest

# Run tests for specific package
uv run --package amzn-smart-product-onboarding-core-utils pytest

# Run linting
uv run ruff check .
uv run ruff format .

# Add dependency to specific package
uv add --package amzn-smart-product-onboarding-core-utils boto3

# Add workspace dependency
uv add --package amzn-smart-product-onboarding-metaclasses amzn-smart-product-onboarding-core-utils --workspace
```

### Package Dependencies

```
api/handlers → api/runtime
metaclasses → core-utils, api/runtime
product-categorization → core-utils, api/runtime
```

## Workspace Configuration

The workspace is configured in `pyproject.toml` with:

- **Workspace members**: All Python packages in the project
- **Shared development dependencies**: Testing, linting, and AWS tools
- **Workspace sources**: Cross-package dependency resolution
- **Tool configurations**: Ruff, pytest, and mypy settings

## Migration from Poetry

This workspace replaces the previous Poetry-based dependency management:

- Unified dependency resolution across all packages
- Faster dependency installation and resolution
- Simplified development workflow
- Better integration with modern Python tooling

## Docker Integration

For Lambda packaging and Docker builds, use:

```bash
# Export requirements without workspace packages
uv export --no-emit-workspace --frozen --no-dev --no-editable -o requirements.txt

# Install with platform targeting for Lambda
uv pip install --target lambda_package --python-platform aarch64-unknown-linux-gnu --python-version 3.13 -r requirements.txt
```
