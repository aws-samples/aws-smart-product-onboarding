---
inclusion: always
---

# NX Monorepo Development Guide

## Overview

This project uses NX monorepo with pnpm workspaces for efficient development and build management. NX provides intelligent build caching, task orchestration, and dependency graph analysis across all packages. The workspace is configured with AWS PDK patterns for accelerated development.

## Key NX Commands

All commands use `pnpm exec nx` for consistent execution:

### Development Commands

```bash
# Website development
pnpm exec nx dev @aws-samples/smart-product-onboarding-demo-website
pnpm exec nx build @aws-samples/smart-product-onboarding-demo-website
pnpm exec nx preview @aws-samples/smart-product-onboarding-demo-website

# Infrastructure
pnpm exec nx deploy @aws-samples/smart-product-onboarding-infra
pnpm exec nx diff @aws-samples/smart-product-onboarding-infra
pnpm exec nx destroy @aws-samples/smart-product-onboarding-infra
pnpm exec nx synth @aws-samples/smart-product-onboarding-infra

# API development
pnpm exec nx build @aws-samples/smart-product-onboarding-api
pnpm exec nx generate @aws-samples/smart-product-onboarding-api-model

# Python packages
pnpm exec nx build amzn-smart-product-onboarding-core-utils
pnpm exec nx test amzn-smart-product-onboarding-metaclasses

# Workspace-wide operations
pnpm exec nx run-many -t build
pnpm exec nx run-many -t lint
pnpm exec nx run-many -t test

# Project information
pnpm exec nx show projects
pnpm exec nx show project <project-name>
pnpm exec nx graph
```

### Affected Commands

Run tasks only for projects affected by changes:

```bash
# Build only affected projects
pnpm exec nx affected -t build

# Test only affected projects
pnpm exec nx affected -t test

# Lint only affected projects
pnpm exec nx affected -t lint

# Show affected projects
pnpm exec nx show projects --affected
```

### Multi-project Commands

```bash
# Run tasks for specific projects
pnpm exec nx run-many -t build --projects=frontend,hotel-pms-lambda
pnpm exec nx run-many -t lint --projects=frontend,websocket-server

# Run tasks for all projects
pnpm exec nx run-many -t build
pnpm exec nx run-many -t test
```

## NX Configuration

### Target Defaults

- **build**: Depends on upstream builds (`^build`), cached, outputs to dist/lib/build
- **compile**: Depends on upstream compiles (`^compile`), cached
- **test**: Depends on compile, cached, outputs coverage/test-reports
- **lint**: Uses default inputs, cached
- **package**: Depends on build, outputs distribution files (.tgz, .whl)
- **synth**: CDK synthesis, depends on build, outputs cdk.out
- **deploy**: CDK deployment, depends on synth
- **install**: Dependency installation, cached

### Named Inputs

- **default**: All project files (`{projectRoot}/**/*`)
- **typescript**: TypeScript files, configs, and dependencies
- **python**: Python files, pyproject.toml, uv.lock files

### AWS PDK Integration

API generators and generated packages include `AWS_PDK_VERSION=0.26.7` environment variable for consistent code generation.

## Project Structure

Each package has a `project.json` file defining its NX configuration:

```json
{
  "name": "package-name",
  "targets": {
    "build": {
      /* build configuration */
    },
    "test": {
      /* test configuration */
    },
    "lint": {
      /* lint configuration */
    }
  }
}
```

## Package-specific Commands

### Dependency Management

```bash
# TypeScript packages - use pnpm filters
pnpm --filter @aws-samples/smart-product-onboarding-demo-website add <dependency>
pnpm --filter @aws-samples/smart-product-onboarding-infra add <dependency>

# Python packages - use uv within workspace root
cd packages/smart-product-onboarding && uv add --package amzn-smart-product-onboarding-core-utils <dependency>
```

### Task Execution

Always use NX for task execution to leverage caching and dependency management:

```bash
# Correct - uses NX orchestration
pnpm exec nx build @aws-samples/smart-product-onboarding-demo-website
pnpm exec nx test amzn-smart-product-onboarding-core-utils

# Avoid - bypasses NX benefits
cd packages/website && pnpm build
```

## NX Monorepo Benefits

### Intelligent Build Caching

- NX caches build outputs and only rebuilds what's changed
- Shared cache across team members and CI/CD
- Significant time savings on repeated builds

### Task Orchestration

- Automatically handles task dependencies (e.g., frontend build before
  infrastructure deploy)
- Parallel execution of independent tasks
- Proper ordering of dependent tasks

### Dependency Graph

- Visualize and understand project relationships with `pnpx nx graph`
- Understand impact of changes across the monorepo
- Identify circular dependencies

### Affected Commands

- Run tasks only for projects affected by your changes
- Efficient CI/CD pipelines that only test/build what changed
- Faster development feedback loops

### Consistent Tooling

- Unified commands across different technologies (React, Python, Docker)
- Consistent task naming and execution
- Shared configuration and standards

## Local Development Workflows

### Full Stack Development

```bash
# Terminal 1: Start website with hot reload
pnpm exec nx dev @aws-samples/smart-product-onboarding-demo-website

# Terminal 2: Watch for API changes and regenerate
pnpm exec nx watch @aws-samples/smart-product-onboarding-api-typescript-runtime

# Terminal 3: Infrastructure development
pnpm exec nx watch @aws-samples/smart-product-onboarding-infra
```

### Website Development

```bash
# Development server with hot reload
pnpm exec nx dev @aws-samples/smart-product-onboarding-demo-website

# Build and preview
pnpm exec nx build @aws-samples/smart-product-onboarding-demo-website
pnpm exec nx preview @aws-samples/smart-product-onboarding-demo-website
```

### Infrastructure Development

```bash
# Synthesize CDK templates
pnpm exec nx synth @aws-samples/smart-product-onboarding-infra

# Show deployment diff
pnpm exec nx diff @aws-samples/smart-product-onboarding-infra

# Deploy infrastructure
pnpm exec nx deploy @aws-samples/smart-product-onboarding-infra

# Clean up resources
pnpm exec nx destroy @aws-samples/smart-product-onboarding-infra
```

### API Development

```bash
# Generate API code from OpenAPI spec
pnpm exec nx generate @aws-samples/smart-product-onboarding-api-model

# Build all API components
pnpm exec nx build @aws-samples/smart-product-onboarding-api
```

## Best Practices

1. **Use full project names**: Always use complete project names (e.g., `@aws-samples/smart-product-onboarding-demo-website`) for clarity
2. **Leverage caching**: NX automatically caches build, test, lint, compile, package, and install operations
3. **Respect dependencies**: NX automatically handles build order based on project dependencies
4. **Use affected commands**: Run `pnpm exec nx affected -t build` in CI/CD for efficiency
5. **Visualize dependencies**: Use `pnpm exec nx graph` to understand project relationships
6. **AWS PDK integration**: API generation targets include AWS_PDK_VERSION for consistent code generation
7. **Mixed language support**: Workspace handles both TypeScript (pnpm) and Python (uv) packages seamlessly

## Troubleshooting

### Cache Issues

```bash
# Clear NX cache
pnpm exec nx reset

# Clean everything (use package.json script for this)
pnpm clean
```

### Dependency Issues

```bash
# Reinstall all dependencies (use package.json script)
pnpm clean && pnpm install
```

### Build Issues

```bash
# Check project configuration
pnpm exec nx show project @aws-samples/smart-product-onboarding-demo-website

# Run with verbose output
pnpm exec nx build @aws-samples/smart-product-onboarding-infra --verbose

# Show project graph for debugging dependencies
pnpm exec nx graph

# Check specific project dependencies
pnpm exec nx show project amzn-smart-product-onboarding-metaclasses --with-target-dependencies
```

## Project Architecture

### Package Types

- **TypeScript packages**: Use `@aws-samples/` prefix, managed by pnpm
- **Python packages**: Use `amzn-` prefix, managed by uv
- **Generated packages**: Auto-generated from API specifications, do not edit directly

### Key Dependencies

- Infrastructure depends on website, API infrastructure, and runtime
- Python packages depend on core-utils for shared functionality
- API handlers depend on their respective runtime packages
- Generated packages depend on API model specifications
