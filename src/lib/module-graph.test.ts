import { mkdirSync, mkdtempDisposableSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "bun:test";
import { build, normalizePath } from "vite";

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

async function buildGraph(root: string): Promise<Map<string, Array<string>>> {
  const source = path.join(root, "src");
  const files = (new Map<string, string>);

  for (const file of new Bun.Glob("**/*.{ts,tsx,js,jsx,vue}").scanSync(source)) {
    const relative = normalizePath(file);

    if ((/\.(?:test|bench|d)\.[jt]sx?$/u).test(relative) || relative.startsWith("__mocks__/")) {
      continue;
    }
    files.set(normalizePath(path.resolve(source, file)), relative);
  }
  const graph = (new Map<string, Array<string>>);

  await build({
    root,
    "logLevel": "error",
    "build"   : {
      "write"               : false,
      "minify"              : false,
      "reportCompressedSize": false,
      "rolldownOptions"     : { "input": [...files.keys()] },
    },
    "plugins": [{
      "name": "collect-source-imports",
      buildEnd(error): void {
        if (error) return;
        for (const id of this.getModuleIds()) {
          const file = files.get(normalizePath(id));

          if (file === undefined) continue;
          const { importedIds } = this.getModuleInfo(id)!;

          graph.set(file, importedIds.flatMap(target => files.get(normalizePath(target)) ?? []));
        }
      },
    }],
  });

  expect(graph.size).toBe(files.size);

  return graph;
}

test("Vite resolves eager globs, TSX, JSX and inline type imports", async () => {
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
    "b.ts": "import \"/src/a.tsx\"; export type T = (tag: string) => unknown;",
  };

  for (const [file, source] of Object.entries(sources)) {
    writeFileSync(path.join(sourceDirectory, file), source);
  }
  const graph = await buildGraph(directory.path);

  expect(graph.get("lazy.tsx")).toEqual([]);
  expect(cycles(graph).sort()).toEqual([["a.tsx", "b.ts"], ["eager.tsx", "match.jsx"]]);
});

test("production value imports have no eager cycles, including self-barrels", async () => {
  const graph = await buildGraph(path.resolve(import.meta.dir, "../.."));
  const selfBarrels: Array<string> = [];

  for (const [file, edges] of graph) {
    for (const target of edges) {
      const directory = path.posix.dirname(target);

      if ((/(?:^|\/)index\.[jt]sx?$/u).test(target) &&
        (directory === "." || file.startsWith(directory + "/"))) {
        selfBarrels.push(`${file} -> ${target}`);
      }
    }
  }
  expect(selfBarrels).toEqual([]);
  expect(cycles(graph)).toEqual([]);
});
