import { expect, test } from "bun:test";

import { PermissionService } from "./request-permissions.ts";

const firstHash = "a".repeat(64);
const secondHash = "b".repeat(64);

test("queued batches keep their inputs, cooldowns and grant identities", async () => {
  let now = 0;
  const store: Record<string, Record<string, boolean>> = { "plugin": { "log::read": true } };
  const service = new PermissionService(store, () => now);
  const first = service.request(["log::read", "time::date"], "plugin", firstHash);
  const queued = ["log::read"];
  const second = service.request(queued, "plugin", secondHash);

  queued[0] = "ui::basic";
  await Promise.resolve();
  const read = service.prompt.value!;

  now = 4999;
  expect(service.answer(read.id, true)).toBe(false);
  now++;
  expect(service.answer(read.id, true)).toBe(true);
  await Promise.resolve();
  const date = service.prompt.value!;

  expect(date.permission).toBe("time::date");
  expect(service.answer(read.id, false)).toBe(false);
  now += 4999;
  expect(service.answer(date.id, true)).toBe(false);
  now++;
  expect(service.answer(date.id, true)).toBe(true);
  expect(await first).toEqual(["log::read", "time::date"]);
  await Promise.resolve();
  const next = service.prompt.value!;

  expect(next.permission).toBe("log::read");
  expect(service.answer(next.id, false)).toBe(true);
  expect(await second).toEqual([false]);
  expect(store).toEqual({
    "plugin"                  : { "log::read": true },
    [`artifact/${firstHash}`] : { "log::read": true, "time::date": true },
    [`artifact/${secondHash}`]: { "log::read": false },
  });
});

test("disposal rejects active and queued requests without saving grants", async () => {
  const store = {};
  const service = new PermissionService(store);
  const results = Promise.allSettled([firstHash, secondHash].map(hash => (
    service.request(["time::date"], "plugin", hash)
  )));

  await Promise.resolve();
  const id = service.prompt.value!.id;

  service.dispose();
  const settled = await results;

  expect(settled.map(result => result.status)).toEqual(["rejected", "rejected"]);
  expect(service.answer(id, true)).toBe(false);
  expect(store).toEqual({});
});

test("invalid batches reject before any prompt or write", async () => {
  const store = {};
  const service = new PermissionService(store);

  for (const invalid of ["internet::http-get::tauri://localhost", "log::write::extra"]) {
    await expect(service.request(["time::date", invalid], "plugin", firstHash)).rejects.toThrow();
    expect(service.prompt.value).toBeUndefined();
    expect(store).toEqual({});
  }
});

test("JS callers must supply an artifact digest", async () => {
  const store = {};
  const service = new PermissionService(store);

  // @ts-expect-error Simulate a caller still using the old two-argument API.
  await expect(service.request(["log::read"], "plugin")).rejects.toThrow("SHA-256");
  expect(service.prompt.value).toBeUndefined();
  expect(store).toEqual({});
});

test("closing one sandbox withdraws its prompt and leaves other sandboxes queued", async () => {
  const service = new PermissionService({});
  const controller = new AbortController;
  const first = service.request(["log::read"], "first", firstHash, controller.signal);
  const next = service.request(["ui::basic"], "second", secondHash);

  await Promise.resolve();
  expect(service.prompt.value?.extension).toBe("first");
  controller.abort(new Error("Worker disposed"));
  await expect(first).rejects.toThrow("Worker disposed");
  expect(service.prompt.value?.extension).toBe("second");
  service.answer(service.prompt.value!.id, false);
  expect(await next).toEqual([false]);
});
