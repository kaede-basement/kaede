import path from "node:path";

import vue from "@vitejs/plugin-vue";
import unocss from "unocss/vite";
import eslint from "vite-plugin-eslint2";
// 'vitest/config' extends 'vite' config
import { defineConfig } from "vitest/config";

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
  ],
});
