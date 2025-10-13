# Nx Migration Plan

## Current State Analysis

### Existing Nx Configuration

The project already has Nx configured with:

- **Target defaults**: Build targets with proper inputs/outputs and dependencies
- **Cacheable operations**: Build and test operations are cached
- **Implicit dependencies**: Infrastructure package depends on handlers and Python packages
- **Project structure**: All packages have `project.json` files with Nx targets

### Current Target Structure

All packages currently use `nx:run-commands` executor pointing to `scripts/run-task` commands. This is exactly what we need to replace with native Nx executors.

## Migration Strategy

### Phase 1: Replace Script-Based Targets with Native Executors

#### 1.1 TypeScript Packages (infra, website, handlers/typescript)

**Current**: `scripts/run-task compile` → **Target**: Native TypeScript compilation

```json
{
  "compile": {
    "executor": "@nx/js:tsc",
    "outputs": ["{projectRoot}/lib"],
    "options": {
      "main": "{projectRoot}/src/index.ts",
      "tsConfig": "{projectRoot}/tsconfig.json",
      "outputPath": "{projectRoot}/lib"
    }
  }
}
```

#### 1.2 Python Packages (core-utils, metaclasses, product-categorization)

**Current**: `scripts/run-task test` → **Target**: Native Python testing

```json
{
  "test": {
    "executor": "nx:run-commands",
    "options": {
      "command": "poetry run pytest",
      "cwd": "{projectRoot}",
      "env": {
        "VIRTUAL_ENV": "$(poetry env info -p)",
        "PATH": "$(poetry env info -p)/bin:$PATH"
      }
    }
  }
}
```

#### 1.3 React Package (website)

**Current**: `scripts/run-task dev` → **Target**: Native React development

```json
{
  "dev": {
    "executor": "nx:run-commands",
    "options": {
      "command": "react-scripts start",
      "cwd": "{projectRoot}",
      "env": {
        "ESLINT_NO_DEV_ERRORS": "true",
        "TSC_COMPILE_ON_ERROR": "true"
      }
    }
  }
}
```

### Phase 2: Implement Target Dependencies

#### 2.1 Standard Build Pipeline

```json
{
  "build": {
    "dependsOn": ["pre-compile", "compile", "post-compile", "test", "package"]
  }
}
```

#### 2.2 Cross-Package Dependencies

```json
{
  "implicitDependencies": [
    "amzn-smart-product-onboarding-api-python-handlers",
    "@aws-samples/smart-product-onboarding-api-typescript-handlers",
    "amzn-smart-product-onboarding-product-categorization",
    "amzn-smart-product-onboarding-metaclasses"
  ]
}
```

### Phase 3: Environment Variable Management

#### 3.1 Global Environment Variables (nx.json)

```json
{
  "targetDefaults": {
    "build": {
      "env": {
        "PATH": "$(pnpm -c exec \"node --print process.env.PATH\")"
      }
    }
  }
}
```

#### 3.2 Package-Specific Environment Variables

- **Python packages**: Dynamic PYTHON_VERSION, VIRTUAL_ENV, PATH
- **API handlers**: AWS_PDK_VERSION
- **Website**: DISABLE_ESLINT_PLUGIN, ESLINT_NO_DEV_ERRORS

## Detailed Migration Steps

### Step 1: Update nx.json Target Defaults

Add comprehensive target defaults for all task types:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["default", "^default"],
      "outputs": [
        "{projectRoot}/dist",
        "{projectRoot}/lib",
        "{projectRoot}/build"
      ]
    },
    "test": {
      "inputs": ["default", "^default", "{projectRoot}/test/**/*"],
      "outputs": ["{projectRoot}/coverage", "{projectRoot}/test-reports"]
    },
    "lint": {
      "inputs": ["default", "{projectRoot}/.eslintrc.json"],
      "outputs": []
    }
  }
}
```

### Step 2: Convert High-Priority Targets

#### Infrastructure Package

1. **compile**: Use `@nx/js:tsc` executor
2. **test**: Use `@nx/jest:jest` executor
3. **lint**: Use `@nx/eslint:lint` executor
4. **deploy**: Keep as `nx:run-commands` with CDK commands
5. **synth**: Keep as `nx:run-commands` with CDK commands

#### Website Package

1. **compile**: Use `nx:run-commands` with `react-scripts build`
2. **dev**: Use `nx:run-commands` with `react-scripts start`
3. **test**: Use `nx:run-commands` with `react-scripts test`
4. **lint**: Use `@nx/eslint:lint` executor

#### TypeScript Handlers

1. **compile**: Use `@nx/js:tsc` executor
2. **test**: Use `@nx/jest:jest` executor
3. **lint**: Use `@nx/eslint:lint` executor
4. **generate**: Keep as `nx:run-commands` with PDK commands
5. **package**: Keep as `nx:run-commands` with esbuild

#### Python Packages

1. **test**: Use `nx:run-commands` with `poetry run pytest`
2. **package**: Use `nx:run-commands` with `poetry build`
3. **install**: Use `nx:run-commands` with poetry commands

### Step 3: Update Project Dependencies

Ensure all `implicitDependencies` are correctly set:

- Infrastructure depends on all handler and Python packages
- Website depends on API model
- Generated packages depend on model changes

### Step 4: Test Migration

1. Test each converted target individually
2. Test build pipeline end-to-end
3. Verify environment variables are preserved
4. Confirm caching works correctly

### Step 5: Remove Generated Scripts

Once all targets are converted and tested:

1. Delete all `scripts/` directories
2. Update any remaining references to script commands
3. Clean up package.json scripts that reference scripts/run-task

## Expected Benefits

### Performance Improvements

- **Native executors**: Faster execution without script overhead
- **Better caching**: More granular caching with proper inputs/outputs
- **Parallel execution**: Nx can run independent tasks in parallel

### Developer Experience

- **Consistent commands**: All tasks use `nx run` syntax
- **Better error reporting**: Native executors provide better error messages
- **IDE integration**: Better integration with Nx-aware IDEs

### Maintenance Benefits

- **No script maintenance**: Remove 14+ generated script files
- **Cleaner project structure**: Standard Nx project layout
- **Better dependency tracking**: Explicit target dependencies

## Risk Mitigation

### Backup Strategy

- Keep generated scripts until migration is complete and tested
- Use feature branch for migration work
- Test each package conversion individually

### Rollback Plan

- If issues arise, can temporarily revert to script-based targets
- Generated scripts remain available until cleanup phase

### Testing Strategy

- Unit test each converted target
- Integration test full build pipeline
- Performance test to ensure no regression
- CI/CD pipeline testing

## Success Criteria

1. ✅ All 47 identified tasks converted to native Nx targets
2. ✅ All environment variables preserved and working
3. ✅ Build pipeline maintains same functionality
4. ✅ Performance equal or better than script-based approach
5. ✅ All generated scripts removed
6. ✅ CI/CD pipeline updated and working
7. ✅ Developer workflow unchanged or improved
