# UV Workspaces Development Guide

## Overview

UV workspaces allow managing multiple related Python packages in a single
repository with shared dependency resolution and coordinated development
workflows. This guide covers workspace-specific patterns and best practices for
the hotel assistant project.

## Workspace Structure

### Root Configuration

The workspace root `pyproject.toml` defines the workspace and shared
configuration:

```toml
[tool.uv.workspace]
members = [
    "package-a",
    "package-b",
    "package-common"
]

[tool.uv.sources]
package-common = { workspace = true }

[dependency-groups]
dev = [
    # Shared development tools
    "ruff>=0.8.2",
    "pytest>=8.3.5",
]
```

### Member Package Structure

Each workspace member maintains its own `pyproject.toml`:

```toml
[project]
name = "package-name"
version = "1.0.0"
dependencies = [
    # External dependencies
    "boto3>=1.37.31",
    # Workspace dependencies
    "package-common",
]

[dependency-groups]
dev = [
    # Package-specific dev dependencies
    "moto[all]>=5.0.16",
]
```

## Workspace Commands

### Development Workflow

```bash
# Install all workspace packages and dependencies
uv sync

# Install specific workspace member
uv sync --package package-name

# Add dependency to specific package
uv add --package package-name boto3

# Add workspace dependency
uv add --package package-a package-common --workspace

# Run commands in workspace context
uv run --package package-name python -m package_name

# Run tests for specific package
uv run --package package-name pytest
```

### Dependency Management

```bash
# Update all workspace dependencies
uv lock --upgrade

# Update specific package dependencies
uv lock --upgrade-package boto3

# Check for dependency conflicts
uv tree

# Export requirements for specific package
uv export --package package-name --format requirements-txt
```

## Docker Integration

### Multi-stage Builds

For workspace-based Docker builds, use selective copying:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Copy workspace configuration
COPY pyproject.toml uv.lock ./
COPY README.md ./

# Copy shared packages
COPY package-common/ ./package-common/

# Copy target package
COPY target-package/pyproject.toml ./target-package/
COPY target-package/README.md ./target-package/
COPY target-package/src/ ./target-package/src/

# Install dependencies
RUN uv sync --frozen --package target-package

ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "target_package"]
```

### Build Context Optimization

- Only copy necessary files for dependency resolution
- Use `.dockerignore` to exclude unnecessary workspace members
- Leverage Docker layer caching with selective COPY commands

## Shared Code Patterns

### Common Package Structure

```
workspace-common/
├── pyproject.toml
└── workspace_common/
    ├── __init__.py
    ├── config/
    │   ├── __init__.py
    │   └── settings.py
    ├── utils/
    │   ├── __init__.py
    │   └── helpers.py
    └── exceptions/
        ├── __init__.py
        └── base.py
```

### Workspace Dependencies

Reference workspace packages in member `pyproject.toml`:

```toml
[project]
dependencies = [
    "workspace-common",  # Automatically resolved as workspace dependency
]
```

## Best Practices

### Workspace Organization

1. **Clear separation**: Each package should have a distinct purpose
2. **Minimal dependencies**: Avoid circular dependencies between workspace
   packages
3. **Shared utilities**: Extract common code to shared packages
4. **Documentation**: Document workspace structure and relationships

### Development Workflow

1. **Sync regularly**: Run `uv sync` after pulling changes
2. **Test isolation**: Ensure packages can be tested independently
3. **Dependency hygiene**: Regularly review and clean up dependencies
4. **Lock file management**: Commit `uv.lock` for reproducible builds

## Troubleshooting

### Common Issues

1. **Dependency conflicts**: Use `uv tree` to identify conflicts
2. **Import errors**: Ensure workspace packages are properly installed
3. **Docker build failures**: Verify all required files are copied
4. **Version mismatches**: Check workspace dependency resolution

### Debug Commands

```bash
# Show workspace structure
uv tree

# Show package information
uv show package-name

# Verify workspace configuration
uv workspace list

# Check dependency resolution
uv lock --dry-run
```

This workspace approach enables better code organization, dependency management,
and build optimization for multi-package Python projects.
