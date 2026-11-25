import { expect, spyOn, test } from "bun:test";

import { GlobalObject } from "@/extendable/global-object.ts";
import { log } from "@/lib/logging/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

import { catchSyncResponseHooks } from "./catch-sync-response-hooks.ts";

test("pre-launch and argument hook responses keep credentials out of debug logs", () => {
  const token = "synthetic-hook-token";
  const info = { "user": { "account": { token } } } as PreLaunchInformationType;
  const command = `--accessToken ${token}`;
  const { onPreLaunchInformation, onLaunchArgumentsReplace } = GlobalObject.hooks;

  using debug = spyOn(log, "debug");
  using format = spyOn(log.templates.hooks.iterate, "response")
    .mockImplementation((...fields) => JSON.stringify(fields));

  onPreLaunchInformation.after.push(() => ({ "status": "stop", "response": info }));
  onLaunchArgumentsReplace.after.push(() => ({ "status": "stop", "response": command }));
  try {
    expect(catchSyncResponseHooks({
      "scope": "onPreLaunchInformation", "timing": "after", "toPass": info,
    })).toBe(info);
    expect(catchSyncResponseHooks({
      "scope": "onLaunchArgumentsReplace", "timing": "after", "toPass": { "auth": { token } },
    })).toBe(command);
    for (const scope of ["onPreLaunchInformation", "onLaunchArgumentsReplace"]) {
      expect(format).toHaveBeenCalledWith(scope, "stop", "after", 0, expect.any(Number));
    }
    const messages = JSON.stringify(debug.mock.calls);

    expect(messages).toContain("onLaunchArgumentsReplace");
    expect(messages).not.toContain(token);
  } finally {
    onPreLaunchInformation.after.pop();
    onLaunchArgumentsReplace.after.pop();
  }
});
