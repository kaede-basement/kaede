import path from "node:path";

import { expect, test } from "bun:test";
import { build } from "vite";

test("Home static imports exclude optional pages, widgets and packages", async () => {
  const bundle = await build({ "logLevel": "error", "build": { "write": false } });

  if (Array.isArray(bundle) || !("output" in bundle)) throw new Error("Expected one bundle");
  const chunks = bundle.output.filter(file => file.type === "chunk");
  const entry = chunks.find(file => file.isEntry)!;
  const eager = new Set([entry.fileName]);

  for (const name of eager) {
    for (const dependency of chunks.find(chunk => chunk.fileName === name)!.imports) {
      eager.add(dependency);
    }
  }

  for (const module of [
    "/Library.vue",
    "/Settings.vue",
    "/AddInstance.vue",
    "/Profile.vue",
    "/LogViewer.vue",
    "/DevelopmentMode.vue",
    "/node_modules/@daidr/minecraft-skin-renderer/",
    "/node_modules/@tanstack/vue-query/",
    "/node_modules/@tanstack/query-core/",
  ]) {
    const owners = chunks.filter(chunk => chunk.moduleIds.some(id => id.includes(module)));

    expect(owners.length).toBeGreaterThan(0);
    expect(owners.some(chunk => eager.has(chunk.fileName))).toBe(false);
  }
});

test("lazy registry loaders keep the synchronous API and provide a client on first use", () => {
  const result = Bun.spawnSync([
    process.execPath,
    "test",
    "--preload",
    "./scripts/setup-tests.ts",
    path.join(import.meta.dir, "lazy-components.cases.ts"),
  ]);

  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  expect(result.exitCode).toBe(0);
});
