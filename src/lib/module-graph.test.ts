import { mkdirSync, mkdtempDisposableSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import vue from "@vitejs/plugin-vue";
import { expect, test } from "bun:test";
import { build, type InlineConfig, mergeConfig, normalizePath } from "vite";

function cycles(graph: Map<string, Array<string>>): Array<Array<string>> {
  const indices = (new Map<string, number>);
  const low = (new Map<string, number>);
  const stack: Array<string> = [];
  const active = (new Set<string>);
  const found: Array<Array<string>> = [];

  function visit(file: string): void {
    const index = indices.size;

    indices.set(file, index);
    low.set(file, index);
    stack.push(file);
    active.add(file);
    for (const target of graph.get(file)!) {
      if (!indices.has(target)) {
        visit(target);
        low.set(file, Math.min(low.get(file)!, low.get(target)!));
      } else if (active.has(target)) {
        low.set(file, Math.min(low.get(file)!, indices.get(target)!));
      }
    }
    if (low.get(file) !== index) return;
    const component: Array<string> = [];

    while (active.has(file)) {
      const member = stack.pop()!;

      active.delete(member);
      component.push(member);
    }
    if (component.length > 1 || graph.get(file)!.includes(file)) found.push(component.sort());
  }

  for (const file of graph.keys()) {
    if (!indices.has(file)) visit(file);
  }

  return found;
}

async function buildGraph(
  inputRoot: string, config: InlineConfig = {},
): Promise<Map<string, Array<string>>> {
  const root = realpathSync.native(inputRoot);
  const source = path.join(root, "src");
  const entries: Array<string> = [];

  for (const file of new Bun.Glob("**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,vue}").scanSync(source)) {
    const relative = normalizePath(file);

    const excluded = (/\.(?:test|bench|d)\.[cm]?[jt]sx?$/u).test(relative);

    if (excluded || relative.startsWith("__mocks__/")) {
      continue;
    }
    entries.push(relative);
  }
  const graph = (new Map<string, Array<string>>);

  await build(mergeConfig(config, {
    root,
    "logLevel": "error",
    "build"   : {
      "write"               : false,
      "minify"              : false,
      "reportCompressedSize": false,
      "rolldownOptions"     : { "input": entries.map(file => path.resolve(source, file)) },
    },
    "plugins": [{
      "name": "collect-source-imports",
      buildEnd(error): void {
        if (error) return;
        const owners = (new Map<string, string>);
        const prefix = normalizePath(path.resolve(root)) + "/";

        for (const id of this.getModuleIds()) {
          const normalized = normalizePath(id);

          if (!normalized.startsWith(prefix) || normalized.includes("/node_modules/")) continue;
          const relative = path.posix.relative(normalizePath(source), normalized);
          const query = relative.indexOf("?");
          const owner = query !== -1 && relative.slice(0, query).endsWith(".vue") &&
            new URLSearchParams(relative.slice(query + 1)).has("vue")
            ? relative.slice(0, query)
            : relative;

          owners.set(id, owner);
          if (!graph.has(owner)) graph.set(owner, []);
        }
        for (const [id, owner] of owners) {
          const edges = graph.get(owner)!;

          for (const target of this.getModuleInfo(id)!.importedIds) {
            const dependency = owners.get(target);

            if (dependency === undefined) continue;
            // Vue imports its own compiled blocks. An import back to the bare SFC is a real edge.
            if (dependency === owner && target !== id && target.includes("?")) continue;
            edges.push(dependency);
          }
        }
      },
    }],
  } satisfies InlineConfig));

  expect(entries.filter(file => !graph.has(file))).toEqual([]);

  return graph;
}

test("Vite finds Vue script, module and eager glob cycles", async () => {
  using directory = mkdtempDisposableSync(path.join(tmpdir(), "kaede-module-graph-"));
  const sourceDirectory = path.join(directory.path, "src");

  mkdirSync(sourceDirectory);
  writeFileSync(path.join(directory.path, "tsconfig.json"), JSON.stringify({
    "compilerOptions": { "verbatimModuleSyntax": true, "jsx": "react", "jsxFactory": "h" },
  }));
  const sources = {
    "eager.tsx": "export const matches = import.meta.glob(\"./*.jsx\", { eager: true });",
    "lazy.tsx" : "export const matches = import.meta.glob(\"./*.jsx\");",
    "match.jsx": "import \"./eager\"; import \"./lazy\";",
    "a.tsx"    : `/** @jsxRuntime classic */
      import { type T } from "./b.ts";
      export const render = (h: T) => <main/>;
    `,
    "Page.vue": `<script setup lang="ts">
      import { title } from "./title";
    </script>
    <template><p>{{ title }}</p></template>`,
    "Self.vue"  : "<script setup lang=\"ts\">import \"./Self.vue\";</script>",
    "title.ts"  : "import \"./Page.vue\"; export const title = \"Title\";",
    "entry.ts"  : "import \"./module.mts\";",
    "module.mts": "import \"./entry.ts\";",
    "b.ts"      : "import \"/src/a.tsx\"; export type T = (tag: string) => unknown;",
  };

  for (const [file, source] of Object.entries(sources)) {
    writeFileSync(path.join(sourceDirectory, file), source);
  }
  const graph = await buildGraph(directory.path, {
    "plugins": [vue()],
    "build"  : { "rolldownOptions": { "external": ["vue"] } },
  });

  expect(graph.get("lazy.tsx")).toEqual([]);
  expect(cycles(graph).sort()).toEqual([
    ["Page.vue", "title.ts"],
    ["Self.vue"],
    ["a.tsx", "b.ts"],
    ["eager.tsx", "match.jsx"],
    ["entry.ts", "module.mts"],
  ]);
});

test("production value imports have no eager cycles, including self-barrels", async () => {
  const graph = await buildGraph(path.resolve(import.meta.dir, "../.."));
  const selfBarrels: Array<string> = [];

  for (const [file, edges] of graph) {
    for (const target of edges) {
      const directory = path.posix.dirname(target);

      if ((/(?:^|\/)index\.[cm]?[jt]sx?$/u).test(target) &&
        (directory === "." || file.startsWith(directory + "/"))) {
        selfBarrels.push(`${file} -> ${target}`);
      }
    }
  }
  expect(selfBarrels).toEqual([]);
  expect(cycles(graph)).toEqual([]);
});
