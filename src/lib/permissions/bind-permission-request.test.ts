import { expect, test } from "bun:test";

import { bindPermissionRequest } from "./index.ts";
import { PermissionService, permissionSession } from "./request-permissions.ts";

test("abort rejects cached SES capability delivery while another prompt stays open", async () => {
  const cachedHash = "b".repeat(64);
  const previous = permissionSession.value;
  const service = new PermissionService({ [`artifact/${cachedHash}`]: { "time::date": true } });

  permissionSession.value = service;
  const pending = service.request(["log::read"], "first", "a".repeat(64));

  try {
    await Bun.sleep(0);
    const prompt = service.prompt.value!;

    expect(prompt.extension).toBe("first");
    const controller = new AbortController;
    const reason = new Error("Activation ended");
    const request = bindPermissionRequest("second", cachedHash, undefined, controller.signal);
    const delivery = request(["time::date"]);

    queueMicrotask(() => controller.abort(reason));
    await expect(delivery).rejects.toBe(reason);
    expect(service.prompt.value).toBe(prompt);
  } finally {
    service.dispose();
    await Promise.allSettled([pending]);
    permissionSession.value = previous;
  }
});

test("disposing the originating service rejects a cached delivery without a signal", async () => {
  const hash = "b".repeat(64);
  const previous = permissionSession.value;
  const service = new PermissionService({ [`artifact/${hash}`]: { "time::date": true } });
  const prompt = Promise.allSettled([service.request(["log::read"], "first", "a".repeat(64))]);

  try {
    await Bun.sleep(0);
    expect(service.prompt.value?.extension).toBe("first");
    permissionSession.value = service;
    const request = bindPermissionRequest("second", hash);
    const delivery = request(["time::date"]);

    permissionSession.value = new PermissionService({});
    queueMicrotask(() => service.dispose());
    await expect(delivery).rejects.toThrow("Permission session closed");
    const [unrelated] = await prompt;

    expect(unrelated.status).toBe("rejected");
  } finally {
    service.dispose();
    await prompt;
    permissionSession.value = previous;
  }
});
