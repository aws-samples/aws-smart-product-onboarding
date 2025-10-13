# Requirements Document

## Introduction

This feature involves migrating the Smart Product Onboarding project from Projen/PDK management to direct pnpm + Nx management. The project currently uses Projen to generate configuration files and manage tasks across a complex monorepo with TypeScript, Python, and CDK packages. The migration will remove the Projen dependency layer while preserving all existing functionality and build processes.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to manage the monorepo directly with pnpm and Nx, so that I have full control over the build configuration without the Projen abstraction layer.

#### Acceptance Criteria

1. WHEN the migration is complete THEN the project SHALL no longer depend on Projen but MAY retain AWS PDK constructs and TypeSafe API components
2. WHEN developers run build commands THEN they SHALL execute directly through Nx targets instead of Projen tasks
3. WHEN the project is built THEN all existing functionality SHALL work identically to the current Projen-managed setup
4. WHEN package.json files are modified THEN they SHALL be directly editable without regeneration from .projenrc.ts

### Requirement 2

**User Story:** As a developer, I want all existing tasks converted to Nx targets, so that the build system continues to work seamlessly.

#### Acceptance Criteria

1. WHEN Projen tasks are converted THEN each task SHALL become an equivalent Nx target in project.json or package.json
2. WHEN task dependencies exist THEN they SHALL be preserved as Nx target dependencies
3. WHEN tasks have environment variables THEN they SHALL be preserved in the Nx target configuration
4. WHEN tasks receive arguments THEN the Nx targets SHALL support the same argument passing

### Requirement 3

**User Story:** As a developer, I want the Python packages to use standard Poetry configuration, so that they can be managed independently of Projen.

#### Acceptance Criteria

1. WHEN Python packages are migrated THEN they SHALL use standard pyproject.toml files without Projen generation
2. WHEN Poetry commands are run THEN they SHALL work directly without Projen wrapper tasks
3. WHEN Python dependencies are updated THEN they SHALL be managed through Poetry directly
4. WHEN Python packages are built THEN they SHALL use standard Poetry build processes
5. WHEN pnpm postinstall runs THEN it SHALL install or update Python packages using Poetry

### Requirement 4

**User Story:** As a developer, I want the TypeScript packages to use standard pnpm configuration, so that they follow standard Node.js practices.

#### Acceptance Criteria

1. WHEN TypeScript packages are migrated THEN they SHALL use standard package.json files without Projen generation
2. WHEN pnpm scripts are run THEN they SHALL execute directly without Projen wrapper tasks
3. WHEN TypeScript dependencies are updated THEN they SHALL be managed through pnpm workspaces directly
4. WHEN TypeScript packages are built THEN they SHALL use standard tsc/esbuild processes

### Requirement 5

**User Story:** As a developer, I want all Projen-generated scripts/ folders removed, so that the project structure is clean and maintainable.

#### Acceptance Criteria

1. WHEN the migration is complete THEN no scripts/ folders created by `projen eject` SHALL exist in any package
2. WHEN tasks need to be executed THEN they SHALL be defined directly in Nx targets or package.json scripts
3. WHEN complex build logic is needed THEN it SHALL be implemented in dedicated build tools or Nx executors
4. WHEN the project is cleaned THEN no Projen-generated artifacts SHALL remain

### Requirement 6

**User Story:** As a developer, I want the CDK infrastructure package to work with standard CDK tooling, so that it follows AWS CDK best practices.

#### Acceptance Criteria

1. WHEN the CDK package is migrated THEN it SHALL use standard cdk.json configuration
2. WHEN CDK commands are run THEN they SHALL execute directly without Projen wrappers
3. WHEN CDK synthesis occurs THEN it SHALL work identically to the current setup
4. WHEN CDK deployment happens THEN all existing deployment targets SHALL continue to work
5. WHEN Nx targets are defined for CDK THEN synth and deploy targets SHALL depend on other package targets when needed
6. WHEN Lambda packages are built THEN the CDK synth and deploy targets SHALL depend on the API handlers build targets

### Requirement 7

**User Story:** As a developer, I want the monorepo workspace configuration to be managed directly, so that I can modify workspace settings without regeneration.

#### Acceptance Criteria

1. WHEN workspace configuration is needed THEN it SHALL be defined in pnpm-workspace.yaml and nx.json directly
2. WHEN workspace dependencies change THEN they SHALL be managed through pnpm workspaces
3. WHEN build orchestration is needed THEN it SHALL use Nx task runners and caching
4. WHEN the workspace is configured THEN it SHALL support all existing build patterns and dependencies
