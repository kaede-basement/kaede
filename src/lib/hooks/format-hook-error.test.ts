import { expect, test } from "bun:test";

import { GlobalObject } from "@/extendable/global-object.ts";
import { catchSyncResponseHooks } from "@/lib/hooks/catch-sync-response-hooks.ts";
import { catchSyncVoidHooks } from "@/lib/hooks/catch-sync-void-hooks.ts";

test("Sync hooks continue after an exception with an unreadable message", () => {
  const hooks = GlobalObject.hooks.onPreLaunchInformation.after;
  const previousLength = hooks.length;
  let calls = 0;

  hooks.push(() => {
    throw Object.defineProperty(new Error("hook failed"), "message", {
      get() {
        throw new Error("unreadable");
      },
    });
  }, () => {
    calls++;

    return { "status": "stop", "response": false };
  });
  try {
    const event = {
      "scope": "onPreLaunchInformation", "timing": "after", "toPass": false,
    } as const;

    expect(catchSyncResponseHooks(event)).toBe(false);
    catchSyncVoidHooks(event);
    expect(calls).toBe(2);
  } finally {
    hooks.splice(previousLength);
  }
});
