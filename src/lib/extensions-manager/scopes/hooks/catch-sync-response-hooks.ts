import { ApplicationNamespace } from "@/constants/application.ts";
import { ExtraHookResponseStatus, HookResponseStatus } from "@/constants/hooks.ts";
import { handleHookResponse } from "@/lib/extensions-manager/scopes/hooks/handle-hook-response.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtensionStatusType, HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export function catchSyncResponseHooks<T>({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof (Window[typeof ApplicationNamespace]["hooks"]);
  "toPass": unknown;
  "timing": "before" | "after";
}): "continue" | T | undefined {
  const timeMeasurementStartBefore = performance.now();
  const currentScopeHooks = window[ApplicationNamespace].hooks[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks = currentScopeHooks[timing] as HookReturnType<unknown, unknown, "non-promise">;

  log.debug(log.templates.hooks.iterate.start(
    scope,
    timing,
    hooks.length,
  ));
  for (const [index, hook] of hooks.entries()) {
    const timeMeasurementStartHook = performance.now();

    log.debug(log.templates.hooks.iterate.execution(
      scope,
      timing,
      index,
      "sync",
    ));
    const { status, response } = hook(toPass) as {
      "status"  : ExtensionStatusType;
      "response": T | undefined;
    };
    const handledResponse = handleHookResponse({
      scope,
      status,
      response,
      timing,
      index,
      "times": {
        "overallStart": timeMeasurementStartBefore,
        "hookStart"   : timeMeasurementStartHook,
      },
    });

    if (handledResponse === ExtraHookResponseStatus.ContinueLoop) {
      continue;
    }

    return handledResponse;
  }

  return HookResponseStatus.Continue;
}
