# Requirements Document

## Introduction

This feature migrates the Smart Product Onboarding project from pyenv/poetry dependency management to uv, while restructuring the Python packages into a proper uv workspace. The migration will eliminate the need for copying generated API runtime code and consolidate Python packages under a unified workspace structure.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to use uv instead of pyenv/poetry for Python dependency management, so that I can benefit from faster dependency resolution and unified tooling.

#### Acceptance Criteria

1. WHEN Python packages are built THEN they SHALL use uv instead of poetry for dependency management
2. WHEN dependencies are installed THEN they SHALL use uv sync instead of poetry install
3. WHEN new dependencies are added THEN they SHALL use uv add instead of poetry add
4. WHEN Python environments are activated THEN they SHALL use uv's virtual environment management
5. WHEN Python packages are tested THEN they SHALL use uv run pytest instead of poetry run pytest

### Requirement 2

**User Story:** As a developer, I want packages/smart-product-onboarding to be a uv workspace, so that I can manage all Python packages with unified dependency resolution.

#### Acceptance Criteria

1. WHEN the workspace is configured THEN packages/smart-product-onboarding SHALL have a root pyproject.toml defining the workspace
2. WHEN workspace members are defined THEN they SHALL include core-utils, metaclasses, product-categorization, and api packages
3. WHEN dependencies are resolved THEN they SHALL be resolved consistently across all workspace members
4. WHEN workspace packages depend on each other THEN they SHALL use workspace references instead of path dependencies
5. WHEN the workspace is synced THEN all member packages SHALL be installed in a shared environment

### Requirement 3

**User Story:** As a developer, I want the API runtime to be generated directly to packages/smart-product-onboarding/api/runtime/, so that I can eliminate the need for copying files between directories.

#### Acceptance Criteria

1. WHEN the API runtime is generated THEN it SHALL be written directly to packages/smart-product-onboarding/api/runtime/
2. WHEN the API generation completes THEN there SHALL be no rsync or copy operations required
3. WHEN packages reference the API runtime THEN they SHALL reference it from the runtime/ subdirectory
4. WHEN the API runtime is updated THEN dependent packages SHALL automatically see the changes
5. WHEN the build process runs THEN it SHALL not include any file copying steps for the API runtime

### Requirement 4

**User Story:** As a developer, I want API handlers moved from packages/api/handlers/python to packages/smart-product-onboarding/api/handlers/, so that all Python code is consolidated in the workspace.

#### Acceptance Criteria

1. WHEN API handlers are relocated THEN they SHALL be moved to packages/smart-product-onboarding/api/handlers/
2. WHEN handlers reference the API runtime THEN they SHALL use workspace-relative imports
3. WHEN handlers are built THEN they SHALL use the uv workspace configuration
4. WHEN Lambda functions are packaged THEN they SHALL include handlers from the new location
5. WHEN the migration is complete THEN packages/api/handlers/python SHALL be removed

### Requirement 5

**User Story:** As a developer, I want all Python packages to use consistent uv configuration, so that development workflows are standardized across the project.

#### Acceptance Criteria

1. WHEN Python packages are configured THEN they SHALL use the standardized uv pyproject.toml template
2. WHEN development dependencies are defined THEN they SHALL use uv dependency groups
3. WHEN packages are built THEN they SHALL use hatchling as the build backend
4. WHEN code quality tools are run THEN they SHALL use consistent ruff configuration
5. WHEN Python versions are specified THEN they SHALL use >=3.12,<4 for consistency

### Requirement 6

**User Story:** As a developer, I want Nx targets updated to use uv commands, so that the monorepo build system works with the new dependency management.

#### Acceptance Criteria

1. WHEN Nx targets are executed THEN they SHALL use uv commands instead of poetry commands
2. WHEN Python packages are installed THEN the install target SHALL use uv sync
3. WHEN Python packages are tested THEN the test target SHALL use uv run pytest
4. WHEN Python packages are built THEN the build target SHALL use uv build
5. WHEN Python packages are packaged for Lambda THEN they SHALL use uv export and pip install with proper platform targeting

### Requirement 7

**User Story:** As a developer, I want notebooks to be a separate uv package, so that configuration notebooks can reference workspace packages without being part of the main workspace.

#### Acceptance Criteria

1. WHEN notebooks are configured THEN they SHALL be a standalone uv package with their own pyproject.toml
2. WHEN notebook dependencies are defined THEN they SHALL reference smart-product-onboarding workspace packages as external dependencies
3. WHEN notebook dependencies are installed THEN they SHALL use uv sync
4. WHEN notebooks are run THEN they SHALL have access to all workspace packages through proper dependency references
5. WHEN notebook environments are activated THEN they SHALL use uv's virtual environment management

### Requirement 8

**User Story:** As a developer, I want Docker builds to work with uv and support Lambda packaging, so that containerized deployments and AWS Lambda functions continue to function properly.

#### Acceptance Criteria

1. WHEN Docker images are built THEN they SHALL use uv for Python dependency management
2. WHEN workspace packages are installed in containers THEN they SHALL use uv sync with proper platform targeting for the target architecture
3. WHEN Lambda packages are created THEN they SHALL use uv export with --no-emit-workspace --frozen --no-dev --no-editable flags
4. WHEN Lambda dependencies are installed THEN they SHALL use uv pip install with --python-platform and --python-version targeting Lambda runtime
5. WHEN workspace packages are installed for Lambda THEN they SHALL be installed separately after external dependencies
6. WHEN container builds complete THEN they SHALL have all required dependencies installed for the target runtime environment
7. WHEN containers run THEN Python applications SHALL start successfully with uv-managed dependencies
