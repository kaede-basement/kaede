import path from "node:path";

import { expect, test } from "bun:test";

for (const [name, ...files] of [
  ["idle UI lifecycle", "idle-ui", "skin-renderer", "avatar", "download-progress"],
  ["instance context lifecycle", "instance-context", "instance-rehydrate", "replacement-process"],
]) test(name, () => {
  const result = Bun.spawnSync([
    process.execPath,
    "test",
    "--randomize",
    "--preload",
    path.resolve(import.meta.dir, "../../scripts/setup-tests.ts"),
    ...files.map(file => path.resolve(import.meta.dir, file + ".cases.ts")),
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() + result.stdout.toString());
  }
  expect(result.exitCode).toBe(0);
});

test("published declarations typecheck the runtime launch hook fixture", () => {
  const result = Bun.spawnSync([
    process.execPath,
    "x",
    "tsc",
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "esnext",
    "--moduleResolution",
    "bundler",
    "--module",
    "esnext",
    path.resolve(import.meta.dir, "../../types/kaede-lib.d.ts"),
    path.resolve(import.meta.dir, "launch-extension-fixture.ts"),
  ]);

  if (result.exitCode !== 0) throw new Error(result.stdout.toString() + result.stderr.toString());
  expect(result.exitCode).toBe(0);
});
