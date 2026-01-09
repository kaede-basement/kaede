import path from "node:path";

import vue from "@vitejs/plugin-vue";
import unocss from "unocss/vite";
import eslint from "vite-plugin-eslint2";
// 'vitest/config' extends 'vite' config
import { defineConfig } from "vitest/config";

function handleSourceFileNames(): {
  "name"     : string;
  "transform": (source: string, id: string) => string;
} {
  return {
    "name"     : "handle-source-file-names",
    "transform": (source: string, id: string): string => {
      /*
       * Replacing is not an option since 'process.cwd'
       * returns 'letter:\path\...' when 'id' is 'letter:/path/...'
       */
      const relativePath = id.slice(process.cwd().length);

      return source.replaceAll(
        "__PRE_BUNDLED_FILENAME__",
        `"${relativePath}"`,
      );
    },
  };
}

export default defineConfig({
  // Better support for Tauri CLI output
  "clearScreen": false,
  // Enable environment variables
  "envPrefix"  : ["VITE_", "TAURI_"],
  "server"     : {
    // Tauri requires a consistent port
    "strictPort": true,
  },
  // Handle '@/...' imports
  "resolve": {
    "alias": {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Tests-related code
  "test": {
    "setupFiles": "vitest.setup.ts",
  },
  "plugins": [
    // Handle a Vue framework
    vue(),
    // Handle a UnoCSS package
    unocss(),
    // Handle an ESLint package
    eslint(),
    // Replace all '__PRE_BUNDLED_FILENAME__,' variables at build time
    handleSourceFileNames(),
  ],
});
