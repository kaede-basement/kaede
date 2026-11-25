import { expect, test } from "bun:test";

test("debug initially uses the disabled logger", () => {
  // The suite preloads a mock logger, so check initialization in a fresh module registry.
  const result = Bun.spawnSync([process.execPath, "-e", `
    import { log } from "./log.ts";
    console.log(typeof log.debug === "function" && log.debug === log["__debug-undefined"]);
  `], { "cwd": import.meta.dir });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString().trim()).toBe("true");
});
