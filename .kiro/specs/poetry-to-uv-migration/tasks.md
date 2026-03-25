# Implementation Plan

- [x] 1. Set up UV workspace structure
  - Create workspace root pyproject.toml in packages/smart-product-onboarding/
  - Configure workspace members for all Python packages
  - Set up shared development dependencies and tool configurations
  - _Requirements: 2.1, 2.2, 5.1, 5.3_

- [x] 2. Migrate core-utils package to uv
  - [x] 2.1 Convert core-utils pyproject.toml to uv format
    - Replace poetry configuration with uv project configuration
    - Update dependencies to use uv dependency format
    - Configure hatchling build backend
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Update core-utils Nx targets for uv
    - Replace poetry commands with uv commands in project.json
    - Update install target to use uv sync
    - Update test target to use uv run pytest
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.3 Test core-utils package with uv
    - Verify uv sync installs dependencies correctly
    - Run tests with uv run pytest
    - Validate package builds with uv build
    - _Requirements: 5.1, 6.3_

- [x] 3. Create API runtime package structure
  - [x] 3.1 Create api/runtime directory structure
    - Create packages/smart-product-onboarding/api/runtime/ directory
    - Set up initial pyproject.toml for API runtime package
    - Configure as workspace member
    - _Requirements: 3.1, 3.2, 2.2_

  - [x] 3.2 Update API generation to target new location
    - Modify API generation Nx target to output to api/runtime/
    - Update output path in type-safe-api generate command
    - Remove rsync/copy operations from package target
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.3 Generate API runtime to new location
    - Run API generation to populate api/runtime/ directory
    - Verify generated code structure matches expectations
    - Ensure pyproject.toml is properly configured for uv
    - _Requirements: 3.1, 3.4_

- [x] 4. Migrate API handlers to workspace
  - [x] 4.1 Move API handlers to workspace location
    - Move code from packages/api/handlers/python/ to packages/smart-product-onboarding/api/handlers/
    - Update import paths to reference workspace API runtime
    - Configure handlers as workspace member
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Convert handlers pyproject.toml to uv format
    - Replace poetry configuration with uv project configuration
    - Update API runtime dependency to use workspace reference
    - Configure development dependencies using uv dependency groups
    - _Requirements: 4.3, 5.1, 5.2_

  - [x] 4.3 Update handlers Nx targets for uv
    - Update project.json to use uv commands
    - Configure Lambda packaging to use uv export
    - Update build targets to reference new location
    - _Requirements: 6.1, 6.4, 6.5_

- [x] 5. Migrate metaclasses package to uv
  - [x] 5.1 Convert metaclasses pyproject.toml to uv format
    - Replace poetry configuration with uv project configuration
    - Update workspace dependencies to use workspace references
    - Configure FAISS and NLTK dependencies for uv
    - _Requirements: 5.1, 5.2, 2.4_

  - [x] 5.2 Update metaclasses Nx targets for uv
    - Replace poetry commands with uv commands in project.json
    - Update test target to handle FAISS and NLTK dependencies
    - Configure build target for uv build
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.3 Test metaclasses package with uv
    - Verify workspace dependencies resolve correctly
    - Test FAISS and NLTK functionality with uv environment
    - Run existing tests with uv run pytest
    - _Requirements: 2.4, 6.3_

- [x] 6. Migrate product-categorization package to uv
  - [x] 6.1 Convert product-categorization pyproject.toml to uv format
    - Replace poetry configuration with uv project configuration
    - Update workspace dependencies to use workspace references
    - Configure Jinja2 and other dependencies for uv
    - _Requirements: 5.1, 5.2, 2.4_

  - [x] 6.2 Update product-categorization Nx targets for uv
    - Replace poetry commands with uv commands in project.json
    - Update test target to use uv run pytest
    - Configure build target for uv build
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.3 Test product-categorization package with uv
    - Verify workspace dependencies resolve correctly
    - Test Jinja2 template functionality with uv environment
    - Run existing tests with uv run pytest
    - _Requirements: 2.4, 6.3_

- [x] 7. Update notebooks to use uv as standalone package
  - [x] 7.1 Convert notebooks pyproject.toml to uv format
    - Replace poetry configuration with uv project configuration
    - Configure workspace packages as external dependencies
    - Set up Jupyter and development dependencies using uv
    - _Requirements: 7.1, 7.2, 5.1_

  - [x] 7.2 Update notebooks dependency references
    - Update package imports to reference workspace packages
    - Configure proper dependency paths for workspace packages
    - Test notebook execution with uv environment
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]\* 7.3 Test notebooks with uv environment
    - Verify notebooks can import workspace packages
    - Test Jupyter notebook execution with uv run
    - Validate all notebook functionality works correctly
    - _Requirements: 7.3, 7.4_

- [x] 8. Update Docker builds for uv
  - refer to https://docs.astral.sh/uv/guides/integration/docker/
  - [x] 8.1 Update Dockerfiles to use uv
    - Replace poetry installation with uv installation in Dockerfiles
    - Update dependency installation commands to use uv sync
    - Configure proper platform targeting for container builds
    - _Requirements: 8.1, 8.2_

  - [x] 8.2 Implement Lambda packaging with uv
    - Update Lambda packaging scripts to use uv export
    - Configure uv pip install with proper platform targeting
    - Implement workspace package installation for Lambda
    - _Requirements: 8.3, 8.4, 8.5_

  - [x] 8.3 Test Docker builds with uv
    - Build container images with uv-based Dockerfiles
    - Test Lambda packaging with uv export workflow
    - Verify all dependencies install correctly in containers
    - _Requirements: 8.6, 8.7_

- [x] 9. Update Nx configuration for uv
  - [x] 9.1 Update global Nx configuration
    - Update nx.json to reference uv.lock instead of poetry.lock
    - Configure Python input patterns for uv files
    - Update target defaults for uv commands
    - _Requirements: 6.1, 5.1_

  - [x] 9.2 Remove old poetry configurations
    - Remove poetry.lock files from all packages
    - Remove poetry.toml files from all packages
    - Clean up old poetry-based Nx target configurations
    - _Requirements: 1.1, 1.2_

  - [x] 9.3 Update infrastructure references
    - Update CDK constructs that reference Python package locations
    - Update Lambda function asset paths for new structure
    - Verify all infrastructure builds work with new package locations
    - _Requirements: 4.4, 4.5_

- [x] 10. Validation and cleanup
  - [x] 10.1 Run comprehensive workspace tests
    - Execute uv sync on workspace root
    - Run all package tests with uv run pytest
    - Verify all workspace dependencies resolve correctly
    - _Requirements: 2.2, 2.3, 2.5_

  - [x] 10.2 Test complete build pipeline
    - Run full Nx build pipeline with uv commands
    - Test API generation and workspace integration
    - Verify Lambda packaging and Docker builds work
    - _Requirements: 6.1, 8.6, 8.7_

  - [x] 10.3 Update documentation and development guides
    - Update README files to reference uv instead of poetry
    - Update development setup instructions for uv
    - Document new workspace structure and commands
    - _Requirements: 1.3, 7.5_

  - [ ]\* 10.4 Performance validation
    - Compare build times between poetry and uv workflows
    - Verify dependency resolution speed improvements
    - Test development workflow efficiency with uv
    - _Requirements: 1.1_
