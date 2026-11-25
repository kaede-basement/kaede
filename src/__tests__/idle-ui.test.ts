import { expect, test } from "bun:test";

test("idle UI lifecycle", () => {
  // Isolate the window, renderer and IPC mocks from the rest of the Bun suite.
  const result = Bun.spawnSync([
    process.execPath,
    "test",
    "--preload",
    "./scripts/setup-tests.ts",
    "./src/__tests__/idle-ui.cases.ts",
    "./src/__tests__/skin-renderer.cases.ts",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString() + result.stdout.toString());
  }
  expect(result.exitCode).toBe(0);
});
