# Design Document

## Overview

This design outlines the migration of the website package from Create React App (CRA) to Vite. The migration will modernize the build system while maintaining all existing functionality, improving development experience, and reducing build times. The solution must integrate seamlessly with the existing Projen-managed monorepo structure and Nx build orchestration.

## Architecture

### Current Architecture

- **Build Tool**: Create React App (react-scripts)
- **Bundler**: Webpack (via react-scripts)
- **Dev Server**: Webpack Dev Server
- **TypeScript**: Handled by react-scripts
- **Testing**: Jest (via react-scripts)
- **Linting**: ESLint with react-app config

### Target Architecture

- **Build Tool**: Vite with Nx integration
- **Nx Plugin**: `@nx/vite` for seamless Nx integration
- **Bundler**: Rollup (production) / ESBuild (development)
- **Dev Server**: Vite Dev Server
- **TypeScript**: Native Vite TypeScript support
- **Testing**: Vitest (Vite's test runner)
- **Linting**: ESLint with custom configuration
- **Task Inference**: Automatic Nx task generation from Vite config

### Migration Strategy

The migration will leverage Nx's Vite plugin for optimal integration:

1. **Phase 1**: Install `@nx/vite` plugin and dependencies
2. **Phase 2**: Use `@nx/vite:configuration` generator to migrate project
3. **Phase 3**: Update custom configurations and environment variables
4. **Phase 4**: Clean up CRA dependencies and pnpm overrides

## Components and Interfaces

### 1. Vite Configuration (`vite.config.ts`)

```typescript
interface ViteConfig {
  plugins: Plugin[];
  build: BuildOptions;
  server: ServerOptions;
  resolve: ResolveOptions;
  define: Record<string, any>;
}
```

**Key Features:**

- React plugin for JSX support
- TypeScript support
- Environment variable handling
- Asset optimization
- Development server configuration
- Build output customization

### 2. Package Dependencies Update

**Dependencies to Remove:**

- `react-scripts`
- CRA-specific ESLint configurations

**Dependencies to Add:**

- `@nx/vite` (Nx Vite plugin)
- `vite` (automatically installed by @nx/vite)
- `@vitejs/plugin-react` (automatically configured by @nx/vite)
- `vitest` (for testing)
- `@types/node` (for Vite config)

**Dependencies to Update:**

- ESLint configuration packages
- TypeScript configuration

**Nx Integration Benefits:**

- Automatic task inference from `vite.config.ts`
- Optimized caching and dependency graph
- Seamless integration with existing Nx workspace

### 3. Nx Integration Updates

**Project Configuration Changes:**

- Use `@nx/vite:configuration` generator for automatic setup
- Nx will automatically infer tasks from `vite.config.ts`
- Maintain existing dependency graph and caching
- Custom targets can be preserved alongside inferred ones

**Inferred Task Mappings:**

- `build` → automatically inferred from Vite config
- `serve` → automatically inferred for development server
- `test` → automatically inferred for Vitest
- `preview` → automatically inferred for production preview
- Custom targets like `pre-compile` and `post-compile` remain unchanged

### 4. Environment Variables Handling

**Current CRA Pattern:**

```
REACT_APP_*
```

**Vite Pattern:**

```
VITE_*
```

**Migration Strategy:**

- Create environment variable mapping
- Update existing environment variables
- Maintain backward compatibility where possible

### 5. Asset Handling

**Static Assets:**

- Move from `public/` (CRA) to `public/` (Vite) - no change needed
- Update asset references if necessary
- Ensure proper asset optimization

**Dynamic Imports:**

- Verify existing dynamic imports work with Vite
- Update if necessary for Vite's ESM-first approach

## Data Models

### Configuration Models

```typescript
interface MigrationConfig {
  sourcePackage: string;
  targetBuildTool: "vite";
  preserveFeatures: string[];
  environmentVariables: EnvironmentVariableMapping[];
  assetPaths: AssetPathMapping[];
}

interface EnvironmentVariableMapping {
  from: string; // REACT_APP_*
  to: string; // VITE_*
}

interface AssetPathMapping {
  from: string;
  to: string;
  type: "static" | "dynamic";
}
```

### Build Configuration

```typescript
interface BuildTarget {
  name: string;
  executor: string;
  command: string;
  dependencies: string[];
  inputs: string[];
  outputs: string[];
}
```

## Error Handling

### Migration Validation

1. **Dependency Conflicts**: Check for version conflicts between Vite and existing packages
2. **Import Resolution**: Validate all import statements work with Vite's ESM approach
3. **Asset Loading**: Ensure all assets load correctly
4. **Environment Variables**: Verify all environment variables are accessible

### Rollback Strategy

1. **Git Branch**: Create feature branch for migration
2. **Backup Configuration**: Preserve original CRA configuration
3. **Incremental Testing**: Test each phase before proceeding
4. **Validation Checklist**: Comprehensive testing before final merge

### Common Issues and Solutions

| Issue                           | Solution                                      |
| ------------------------------- | --------------------------------------------- |
| Import path resolution          | Update `vite.config.ts` resolve aliases       |
| Environment variables not found | Rename `REACT_APP_*` to `VITE_*`              |
| CSS modules not working         | Configure CSS modules in Vite config          |
| Build output location           | Update `build.outDir` in Vite config          |
| TypeScript errors               | Update `tsconfig.json` for Vite compatibility |

## Testing Strategy

### Unit Testing Migration

- **Current**: Jest via react-scripts
- **Target**: Vitest
- **Migration**: Update test configuration and scripts

### Integration Testing

1. **Build Verification**: Ensure production builds work correctly
2. **Development Server**: Verify hot reload and development features
3. **Asset Loading**: Test all static and dynamic assets
4. **Environment Variables**: Validate environment variable access
5. **TypeScript**: Ensure type checking works correctly

### End-to-End Testing

1. **Full Application Flow**: Test complete user workflows
2. **Performance Comparison**: Compare build times and bundle sizes
3. **Cross-Browser Testing**: Ensure compatibility across browsers
4. **Deployment Testing**: Verify deployment process works

### Validation Checklist

- [ ] Application starts successfully in development
- [ ] Hot module replacement works
- [ ] Production build completes without errors
- [ ] All routes and components render correctly
- [ ] Static assets load properly
- [ ] Environment variables are accessible
- [ ] TypeScript compilation works
- [ ] Tests pass with new configuration
- [ ] ESLint rules apply correctly
- [ ] Build output is optimized

## Implementation Phases

### Phase 1: Nx Vite Plugin Setup

1. Install `@nx/vite` plugin in the workspace
2. Run `@nx/vite:configuration` generator on website project
3. Verify automatic Vite configuration generation
4. Remove react-scripts dependency

### Phase 2: Configuration Customization

1. Customize generated `vite.config.ts` for project needs
2. Update environment variables from `REACT_APP_*` to `VITE_*`
3. Configure asset handling and public directory
4. Update TypeScript configuration if needed

### Phase 3: Testing and Validation

1. Test inferred Nx tasks (`nx build website`, `nx serve website`)
2. Validate all existing functionality works
3. Update any custom build processes
4. Test integration with other monorepo packages

### Phase 4: Cleanup and Optimization

1. Remove CRA-related pnpm overrides from root package.json
2. Clean up unused dependencies
3. Optimize Vite configuration for performance
4. Update documentation and scripts

## Performance Expectations

### Development Performance

- **Cold Start**: 50-80% faster than CRA
- **Hot Reload**: Near-instantaneous updates
- **TypeScript**: Faster type checking with esbuild

### Build Performance

- **Production Build**: 30-50% faster build times
- **Bundle Size**: Similar or smaller bundle sizes
- **Tree Shaking**: Better dead code elimination

### Developer Experience

- **Faster Feedback**: Immediate reflection of changes
- **Better Error Messages**: Clearer error reporting
- **Modern Tooling**: Access to latest JavaScript features
