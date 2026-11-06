/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import path from "node:path";

import vue from "@vitejs/plugin-vue";
import { build } from "esbuild";
import unocss from "unocss/vite";
import { defineConfig, type IndexHtmlTransformResult, type Plugin } from "vite";
import eslint from "vite-plugin-eslint2";

function handleSourceFileNames(): {
  "name"     : string;
  "enforce"  : "pre";
  "transform": (source: string, id: string) => { "code": string; "map": null };
} {
  return {
    "name"     : "handle-source-file-names",
    // Ensure that the sources we get are untouched by 'esbuild' and others
    "enforce"  : "pre",
    "transform": (source: string, id: string): { "code": string; "map": null } => {
      /*
       * Replacing is not an option since 'process.cwd'
       * returns 'letter:\path\...' when 'id' is 'letter:/path/...'
       */
      const relativePath: string = id.slice(process.cwd().length);

      // Avoid having 'const "/src/declarations.ts:90": string;' in 'declarations.ts'
      if (relativePath === "/src/declarations.ts") {
        return { "code": source, "map": null };
      }

      return {
        "code": source
          .split("\n")
          .map((line, index) => {
            const lineNumber: number = index + 1;

            return line.replaceAll(
              "__PRE_BUNDLED_FILENAME__",
              `"${relativePath}:${lineNumber}"`,
            );
          })
          .join("\n"),
        "map": null,
      };
    },
  };
}

async function injectSafariPolyfills(): Promise<Plugin> {
  /*
   * Since the structuredClone polyfill is just 3 KiB, we can inline it,
   * but first we need to build it as an immediately invoked function expression
   */
  const { outputFiles } = await build({
    "entryPoints": ["node_modules/@ungap/structured-clone/esm/index.js"],
    // Bundle all imports
    "bundle"     : true,
    "format"     : "iife",
    "platform"   : "browser",
    // Safari < 14.1 seems to not support destructuring (?)
    "target"     : ["safari14.1"],
    "globalName" : "structuredClonePolyfill",
    // Do not write the output to the file system
    "write"      : false,
    "minify"     : true,
  });

  if (!outputFiles) {
    throw new Error("Could not build the structuredClone polyfill");
  }

  const [{ "text": polyfillCode }] = outputFiles;

  return {
    "name"              : "inject-safari-polyfills",
    "transformIndexHtml": {
      "order": "pre",
      "handler"(): IndexHtmlTransformResult {
        return [
          {
            "tag"     : "script",
            "children": `
              // Safari < 14
              // https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList#browser_compatibility
              if (window.matchMedia) {
                const mql = window.matchMedia("(min-width: 1px)");
                const proto = Object.getPrototypeOf(mql);
                
                if (proto && typeof proto.addEventListener !== 'function') {
                  proto.addEventListener = function(type, listener) {
                    this.addListener(listener);
                  };
                  proto.removeEventListener = function(type, listener) {
                    this.removeListener(listener);
                  };
                }
              }

              // Safari < 15
              // https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext#browser_compatibility
              if (window.WebGL2RenderingContext === undefined) {
                window.WebGL2RenderingContext = window.WebGLRenderingContext || {};
              }

              // Safari < 15.4
              // https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone#browser_compatibility
              if (window.structuredClone === undefined) {
                try {
                  ${polyfillCode}
                  // If the polyfill has loaded successfully, then the Safari version
                  // is between 14.1 and 15.3, so we can use a real polyfill
                  window.structuredClone = structuredClonePolyfill.default;
                } catch (error) {
                  window.structuredClone = function(input) {
                    // Kaede only uses 'structuredClone' to clone a 'ConfigType' object
                    // that contains JSON values. Therefore, if the polyfill fails to load,
                    // let the globally available 'structuredClone' just act like a JSON cloner
                    return JSON.parse(JSON.stringify(input));
                  };

                  // May be useful (?)
                  if (!window.__KAEDE__) { window.__KAEDE__ = { errors: {} } }
                  if (!window.__KAEDE__.errors) { window.__KAEDE__.errors = {} }
                  window.__KAEDE__.errors.structuredClonePolyfillFailed = true;

                  window.__TAURI_INTERNALS__
                    .invoke("plugin:log|log", {
                      // Error level
                      "level"   : 5,
                      "message" : "Failed to load the 'structuredClone' polyfill",
                      "location": "vite.config.ts:142",
                    })
                    .catch(function() {
                      console.error("Failed to load the 'structuredClone' polyfill:", error);
                    });
                }
              }
            `,
            "injectTo": "head-prepend",
          },
        ];
      },
    },
  };
}

export default defineConfig({
  // Use '/kaede' base path for GitHub Pages
  "base" : process.env.BASE_PATH || undefined,
  "build": {
    "target"           : process.env.TARGET_OLD_SAFARI === "true" ? ["safari13"] : undefined,
    // Do not inline any images
    "assetsInlineLimit": 0,

    /*
     * UPD: ok Vite 8 chunk emit works properly with the uncommented configuration
     *
     * Vite 8 is genuinely fucking retarded. Not only its new rolldown bundler sucks
     * at emitting chunks, it does not even provide any meaningful performance
     * improvements (builds take 4.5 seconds with vite 8 and 6.5 seconds with vite 7)
     * since the vite plugins take the most time, not rollup/rolldown bundlers.
     * Moreover, sometimes for some unknown reason 'CraftingTableIcon.webp' is removed
     * from the final bundle with Vite 8 (???) What is this stupid ass magic?
     *
     * Related issue:
     * - https://github.com/rolldown/rolldown/issues/10731
     *
     * With the following configuration, I managed to get to this output:
     *
     * dist/assets/rolldown-runtime-XKyaHtl9.js       0.72 kB │ gzip:   0.42 kB
     * dist/assets/PluginPlayground-BNKn4pzs.js      32.06 kB │ gzip:  13.66 kB
     * dist/assets/markdown-libs-CoPiLIXy.js         77.65 kB │ gzip:  26.06 kB
     * dist/assets/schemas-runtime-D_dwmU6M.js       90.17 kB │ gzip:  25.66 kB
     * dist/assets/ExtensionLoader-CO26_PAF.js      120.26 kB │ gzip:  38.71 kB
     * dist/assets/index-HBI0PBZ0.js                538.10 kB │ gzip: 163.35 kB
     *
     * The file size of every bundle and every CSS file produced by Vite 8
     * is bigger than the ones produced Vite 7, which is another issue, but...
     * There is a bigger fish to fry - why does 'rolldown-runtime-XKyaHtl9.js'
     * not being inlined if it is 0.72 KiB? It is genuinely just faster to inline
     * it rather than wait for a static import
     *
     * Additional news: even with the explicit 'schemas-runtime' chunk group, I see:
     *
     * ```
     * var t=`/assets/FabricIcon-djNUUgT3.webp`,
     *      n=`/assets/ForgeIcon-BIoIlPkW.webp`,
     *      r=`/assets/LiteLoaderIcon-D3tKxKuv.webp`
     * ```
     *
     * in the generated schemas-runtime bundle. Which leads the initial loading to include
     * 'index', 'rolldown-runtime', and 'schemas-runtime' bundles even though the schemas
     * were supposed to be included only when the schemas validation fails, and the user
     * needs to see a specific reason for that (thus, including the whole schemas instead
     * of just compiled boolean chains that are like 2-3 KiB at max). Vite 7 only makes
     * a single import of the 'index' bundle in the initial loading. Uhh, whatever...
     *
     * "rolldownOptions"  : {
     *   "output": {
     *     "codeSplitting": {
     *       "groups": [
     *         {
     *           "name"    : "markdown-libs",
     *           // '[\\/]' matches both forward slash and backslash path delimiters
     *           "test"    : /node_modules[\\/](marked|dompurify)/,
     *           "priority": 20,
     *         },
     *         {
     *           "name"    : "schemas-runtime",
     *           "test"    : /src[\\/]lib[\\/]schemas[\\/]types/,
     *           "priority": 15,
     *         },
     *         {
     *           "name": "main-bundle",
     *           "tags": ["$initial"],
     *         },
     *       ],
     *     },
     *   },
     * },
     */
    "rolldownOptions": {
      "output": {
        "codeSplitting": {
          "groups": [
            // Inline both 'marked' and 'dompurify' into a single separate chunk
            {
              "name"    : "markdown-libs",
              // '[\\/]' matches both forward slash and backslash path delimiters
              "test"    : /node_modules[\\/](marked|dompurify)/,
              "priority": 20,
            },
            {
              "name": "main-bundle",
              // '$initial' matches modules statically imported by the entry bundle
              "tags": ["$initial"],
            },
          ],
        },
      },
    },
  },
  "optimizeDeps": {
    "rolldownOptions": {
      "transform": {
        "target": process.env.TARGET_OLD_SAFARI === "true" ? ["safari13"] : undefined,
      },
    },
  },
  // Better support for Tauri CLI output
  "clearScreen": false,
  // Enable environment variables
  "envPrefix"  : ["VITE_", "TAURI_"],
  "server"     : {
    // Tauri requires a consistent port
    "strictPort": true,
  },

  /*
   * Experiments with bundle size
   * "build": {
   *   "rollupOptions": {
   *     "external": ["typebox/compile", "typebox"],
   *   },
   * },
   */

  // Handle '@/...' imports
  "resolve": {
    "alias": {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  "plugins": [
    // Replace all '__PRE_BUNDLED_FILENAME__,' variables at build time
    handleSourceFileNames(),
    ...(process.env.TARGET_OLD_SAFARI === "true" ? [injectSafariPolyfills()] : []),
    // Handle a Vue framework
    vue(),
    // Handle a UnoCSS package
    unocss(),
    // Handle an ESLint package
    eslint(),
  ],
});
