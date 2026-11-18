/// <reference types='vitest' />
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  cacheDir: "../../node_modules/.vite/packages/website",

  plugins: [
    // The UI is English only, so ship React Aria's built-in strings for en-US alone.
    { ...optimizeLocales.vite({ locales: ["en-US"] }), enforce: "pre" },
    react(),
    tailwindcss(),
  ],

  build: {
    outDir: "../../dist/packages/website/bundle",
    emptyOutDir: true,
    reportCompressedSize: true,
    target: "es2022",
  },

  publicDir: "public",

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
    setupFiles: ["src/setupTests.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    reporters: ["default"],
    coverage: {
      reportsDirectory: "../../coverage/packages/website",
      provider: "v8",
    },
  },
});
