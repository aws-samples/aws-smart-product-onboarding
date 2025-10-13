# Implementation Plan

- [x] 1. Analyze current Projen task structure

  - Extract all tasks from .projen/tasks.json files across packages
  - Map task dependencies and execution order
  - Identify custom build logic that needs preservation
  - Document high-level build process steps for reference
  - _Requirements: 2.1, 2.2_

- [x] 2. Run Projen ejection and analyze generated scripts

  - Execute `pnpm exec projen eject` command
  - Examine generated scripts/ folders in each package
  - Document which scripts need conversion to Nx targets
  - _Requirements: 5.1, 5.2_

- [x] 3. Analyze ejected state and plan Nx migration

  - Review all generated scripts and their functionality
  - Identify which scripts can be replaced with direct Nx targets
  - Plan the conversion strategy for each package type
  - Create detailed migration plan for pure Nx management
  - _Requirements: 2.1, 2.3, 5.2_

- [ ] 4. Create new root workspace configuration
- [x] 4.1 Update root package.json with direct Nx scripts

  - Replace projen wrapper scripts (build, test, lint) with direct `nx run-many` commands
  - Update postinstall script to use `nx run-many --target=install --projects=tag:python`
  - Add install:ci script using sequential execution for Python packages
  - Remove projen-specific scripts (pdk, default, eject, upgrade-deps)
  - _Requirements: 1.4, 3.5, 4.2_

- [x] 4.2 Enhance nx.json with comprehensive target defaults and add Python package tags

  - Add target defaults for build, test, lint, package with proper inputs/outputs
  - Configure caching for Python packages using poetry.lock and pyproject.toml as inputs
  - Set up TypeScript target defaults with tsconfig.json and source files as inputs
  - Add environment variable defaults for PATH and AWS_PDK_VERSION
  - Configure implicit dependencies: infra depends on all handlers and Python packages
  - **Add "python" tags to all Python package project.json files** (core-utils, product-categorization, metaclasses, api-python-runtime, api-python-handlers) to enable the postinstall script from task 4.1
  - _Requirements: 7.1, 7.3_

- [x] 4.3 Update pnpm-workspace.yaml configuration

  - Verify all 14 packages are included in workspace configuration
  - Ensure generated packages (packages/api/generated/\*) are properly included
  - Validate workspace dependency resolution for cross-package dependencies
  - _Requirements: 4.3, 7.2_

- [ ] 5. Convert TypeScript packages to direct management
- [x] 5.1 Update API TypeScript handler package (packages/api/handlers/typescript)

  - Replace scripts/run-task commands with native Nx executors (@nx/js:tsc, @nx/jest:jest, @nx/eslint:lint)
  - Update compile target to use @nx/js:tsc with proper tsconfig.json and output paths
  - Convert package target to use esbuild with Lambda packaging and template copying
  - Preserve generate target using type-safe-api generate with AWS_PDK_VERSION environment
  - Update test target to use @nx/jest:jest with proper Jest configuration
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 5.2 Update website package configuration (packages/website)

  - Convert compile target to use react-scripts build with pre-compile dependency
  - Update dev target to use react-scripts start with proper environment variables (ESLINT_NO_DEV_ERRORS, TSC_COMPILE_ON_ERROR)
  - Convert test target to combine react-scripts test and ESLint execution
  - Preserve pre-compile target for API spec copying from packages/api/model/.api.json
  - Update package.json scripts to use direct nx run commands
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 5.3 Update generated API packages (runtime/typescript, infrastructure/typescript, libraries/typescript-react-query-hooks)

  - Convert compile targets to use @nx/js:tsc with generated code as input
  - Update package targets to use pnpm pack for distribution creation
  - Preserve generate targets using type-safe-api generate with proper dependencies
  - Add watch targets for development workflow using tsc --watch
  - Ensure proper dependency chain: model generate → generated package generate → compile
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 6. Convert Python packages to standard Poetry management
- [x] 6.1 Update core-utils package configuration (packages/smart-product-onboarding/core-utils)

  - Remove Projen generation markers from pyproject.toml (managed = true, projen metadata)
  - Convert install target to use poetry install with dynamic VIRTUAL_ENV and PATH setup
  - Update test target to use poetry run pytest with proper environment variables
  - Convert package target to use poetry build with wheel and sdist outputs
  - Add publish targets for PyPI (poetry publish) and test PyPI (poetry publish --repository testpypi)
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.2 Update product-categorization package (packages/smart-product-onboarding/product-categorization)

  - Remove Projen markers and convert to standard Poetry pyproject.toml
  - Preserve local path dependency to core-utils in pyproject.toml dependencies
  - Update Nx targets to use poetry commands with proper environment setup
  - Ensure test target runs pytest with core-utils dependency available
  - Configure package target to build wheel with core-utils dependency resolved
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.3 Update metaclasses package (packages/smart-product-onboarding/metaclasses)

  - Convert pyproject.toml to standard Poetry format removing Projen metadata
  - Maintain dependencies on core-utils and API runtime in pyproject.toml
  - Update Nx targets for Poetry operations with FAISS and NLTK dependencies
  - Configure test target to run pytest with all Python dependencies available
  - Set up package target to build distribution with proper dependency resolution
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 6.4 Update API Python packages (handlers/python, generated/runtime/python)

  - Convert handlers package to standard Poetry with generate target preservation
  - Update runtime package to maintain rsync to smart-product-onboarding/api directory
  - Preserve generate targets using type-safe-api generate for both packages
  - Configure Lambda packaging for handlers with poetry export and pip install
  - Ensure runtime package build includes rsync step to copy generated code
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 7. Convert CDK infrastructure package
- [x] 7.1 Update infra package.json and project.json (packages/infra)

  - Convert compile target to use @nx/js:tsc for TypeScript compilation
  - Update test target to use @nx/jest:jest with proper Jest configuration
  - Convert CDK targets (synth, deploy, destroy, diff, watch) to use direct cdk commands
  - Add deploy:dev target using cdk deploy --hotswap for development
  - Configure post-compile target to run synth:silent after compilation
  - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [x] 7.2 Configure CDK deployment dependencies

  - Set synth target to depend on all Lambda package builds (typescript and python handlers)
  - Configure deploy target to depend on synth completion
  - Set up implicitDependencies on all handler packages and Python packages
  - Configure proper build artifact paths for Lambda functions in CDK context
  - Ensure watch target can detect changes in dependent packages
  - _Requirements: 6.3, 6.4, 6.6_

- [x] 7.3 Test CDK operations with new configuration

  - Run nx run infra:synth to verify CDK synthesis works with new build system
  - Test nx run infra:deploy to validate deployment process end-to-end
  - Verify all Lambda artifacts (TypeScript esbuild bundles, Python wheels) are included
  - Test nx run infra:watch for development workflow
  - Validate cdk diff and cdk destroy operations work correctly
  - _Requirements: 6.3, 6.4_

- [x] 8. Remove Projen artifacts and generated scripts
- [x] 8.1 Remove .projen directories from all packages

  - Delete .projen/tasks.json files
  - Remove other Projen-generated configuration files
  - Clean up any remaining Projen references
  - _Requirements: 5.4_

- [x] 8.2 Delete generated scripts/ folders

  - Remove all scripts/ folders created by projen eject
  - Verify no functionality is lost from script removal
  - Update any references to removed scripts
  - _Requirements: 5.1, 5.2_

- [x] 8.3 Remove Projen dependencies and configuration

  - Remove Projen dependency
  - Delete .projenrc.ts file
  - Clean up any remaining Projen configuration
  - _Requirements: 1.1, 5.4_

- [ ] 9. Validate complete migration
- [ ] 9.1 Test full monorepo build process

  - Run complete build from clean state
  - Verify all packages build successfully
  - Check that build artifacts are generated correctly
  - _Requirements: 1.3, 2.3_

- [ ] 9.2 Run comprehensive test suite

  - Execute all unit tests across packages
  - Run integration tests for API functionality
  - Verify Python package tests work correctly
  - _Requirements: 1.3, 3.4, 4.4_

- [ ] 9.3 Test CDK deployment workflow

  - Perform CDK synthesis with new build system
  - Deploy to test environment
  - Verify all Lambda functions work correctly
  - Test website deployment and functionality
  - _Requirements: 6.3, 6.4, 6.5_

- [ ] 9.4 Performance and functionality validation

  - Compare build times before and after migration
  - Verify Nx caching works effectively
  - Test parallel build execution
  - Confirm all original functionality is preserved
  - _Requirements: 1.3, 7.3, 7.4_

- [ ] 10. Update project documentation
- [x] 10.1 Update README.md with new build system instructions

  - Replace Projen-specific commands with direct pnpm + Nx commands
  - Update development setup instructions to remove `pnpm pdk` references
  - Document new build commands: `pnpm build`, `pnpm test`, `pnpm lint`
  - Update deployment instructions to use direct CDK commands
  - Add troubleshooting section for common Nx/Poetry issues
  - _Requirements: 1.4, 4.2_

- [ ] 10.2 Update steering documentation (.kiro/steering/tech.md)

  - Remove Projen references from technology stack description
  - Update build system section to reflect direct Nx management
  - Modify common commands to use pnpm exec instead of pnpm pdk
  - Update development workflow to reflect new package management approach
  - Document Poetry usage for Python packages
  - _Requirements: 1.4, 3.5_

- [ ] 10.3 Update architecture documentation

  - Update architecture.md to reflect new build system
  - Remove references to .projenrc.ts configuration
  - Document new project structure without Projen artifacts
  - Update dependency management documentation
  - Add section on Nx workspace configuration and targets
  - _Requirements: 1.4, 7.1_
