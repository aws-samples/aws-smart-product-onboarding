import tsconfigPaths from "vite-tsconfig-paths";
/// <reference types='vitest' />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: __dirname,
  cacheDir: "../../node_modules/.vite/packages/website",

  plugins: [react(), tsconfigPaths()],

  define: {
    global: "globalThis",
    "process.env": {},
  },

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: "../../dist/packages/website/bundle",
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [
        /node_modules/,
        /packages\/api\/generated\/libraries\/typescript-react-query-hooks/,
      ],
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      "@aws-samples/smart-product-onboarding-api-typescript-react-query-hooks",
    ],
    exclude: [
      // Exclude ace-builds because it contains webpack-specific loader syntax
      // that causes errors during dev server pre-bundling (esbuild)
      // Production builds (Rollup) handle this correctly as warnings
      "ace-builds",
    ],
  },

  // Explicitly set the public directory
  publicDir: "public",

  // Development server configuration
  server: {
    port: 3000,
    host: "localhost",
    fs: {
      // Allow serving files from monorepo root for pnpm's .pnpm directory structure
      allow: ["../../"],
    },
  },

  preview: {
    port: 3000,
    host: "localhost",
  },

  test: {
    watch: false,
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    reporters: ["default"],
    coverage: {
      reportsDirectory: "../../coverage/packages/website",
      provider: "v8",
    },
    passWithNoTests: true,
  },
});
