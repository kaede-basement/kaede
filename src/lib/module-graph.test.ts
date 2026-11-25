import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "bun:test";
import ts from "typescript";
import { parse } from "vue/compiler-sfc";

function eagerImports(file: string, source: string): Array<string> {
  let script = source;
  const imports: Array<string> = [];

  if (file.endsWith(".vue")) {
    const { descriptor, errors } = parse(source, { "filename": file });

    expect(errors).toEqual([]);
    const blocks = [descriptor.script, descriptor.scriptSetup];

    for (const block of blocks) {
      if (block?.src) imports.push(block.src);
    }
    script = blocks.map(block => block?.content ?? "").join("\n");
  }
  const tree = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);

  for (const node of tree.statements) {
    if (ts.isImportDeclaration(node)) {
      if (node.importClause?.isTypeOnly) continue;
    } else if (ts.isExportDeclaration(node)) {
      const names = node.exportClause;

      if (node.isTypeOnly || (names && ts.isNamedExports(names) &&
        names.elements.length > 0 && names.elements.every(item => item.isTypeOnly))) continue;
    } else continue;
    if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
  }

  return imports;
}

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

function buildGraph(
  files: Set<string>, read: (file: string) => string,
): { "graph": Map<string, Array<string>>; "selfBarrels": Array<string> } {
  const graph = (new Map<string, Array<string>>);
  const selfBarrels: Array<string> = [];

  for (const file of files) {
    const directory = path.posix.dirname(file);
    const edges: Array<string> = [];

    for (const specifier of eagerImports(file, read(file))) {
      let local: string;

      if (specifier.startsWith("@/")) local = specifier.slice(2);
      else if (specifier.startsWith("/src/")) local = specifier.slice(5);
      else if (specifier.startsWith("src/")) local = specifier.slice(4);
      else if (specifier.startsWith(".")) local = path.posix.join(directory, specifier);
      else continue;
      const target = [local, local + ".ts", local + ".vue", path.posix.join(local, "index.ts")]
        .find(candidate => files.has(candidate));

      if (!target) {
        if ((/\.(?:css|json|png|svg|webp)$/u).test(local)) continue;
        throw new Error(`Unresolved local import in ${file}: ${specifier}`);
      }
      edges.push(target);
      if (target.endsWith("/index.ts") && file.startsWith(path.posix.dirname(target) + "/")) {
        selfBarrels.push(`${file} -> ${target}`);
      }
    }
    graph.set(file, edges);
  }

  return { graph, selfBarrels };
}

test("inline type imports and Vite source-root paths retain eager edges", () => {
  const sources = new Map([
    ["a.ts", "import { type T } from \"./b.ts\";"],
    ["b.ts", "import \"/src/a.ts\"; export type T = string;"],
  ]);
  const { graph } = buildGraph(new Set(sources.keys()), file => sources.get(file)!);

  expect(cycles(graph)).toEqual([["a.ts", "b.ts"]]);
});

test("production value imports have no eager cycles, including self-barrels", () => {
  const root = path.resolve(import.meta.dir, "..");
  const files = new Set([...new Bun.Glob("**/*.{ts,vue}").scanSync(root)]
    .map(file => file.split(path.sep).join("/"))
    .filter(file => (
      !(/\.(?:test|bench|d)\.ts$/u).test(file) && !file.startsWith("__mocks__/")
    )));
  const { graph, selfBarrels } = buildGraph(files, file => (
    readFileSync(path.join(root, file), "utf8")
  ));

  expect(selfBarrels).toEqual([]);
  expect(cycles(graph)).toEqual([]);
});
