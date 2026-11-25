import path from "node:path";

import { expect, test } from "bun:test";

for (const [name, ...files] of [
  ["idle UI lifecycle", "idle-ui", "skin-renderer", "avatar", "download-progress"],
  ["instance context lifecycle", "instance-context", "instance-rehydrate"],
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
