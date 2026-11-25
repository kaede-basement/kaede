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
