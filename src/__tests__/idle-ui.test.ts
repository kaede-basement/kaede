import path from "node:path";

import { expect, test } from "bun:test";

test("idle UI lifecycle", () => {
  // Isolate the window, renderer and IPC mocks from the rest of the Bun suite.
  const result = Bun.spawnSync([
    process.execPath,
    "test",
    "--randomize",
    "--preload",
    path.resolve(import.meta.dir, "../../scripts/setup-tests.ts"),
    path.resolve(import.meta.dir, "idle-ui.cases.ts"),
    path.resolve(import.meta.dir, "skin-renderer.cases.ts"),
    path.resolve(import.meta.dir, "avatar.cases.ts"),
    path.resolve(import.meta.dir, "download-progress.cases.ts"),
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() + result.stdout.toString());
  }
  expect(result.exitCode).toBe(0);
});
