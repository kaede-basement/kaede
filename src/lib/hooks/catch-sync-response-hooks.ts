import { ExtraHookResponseStatus, HookResponseStatus } from "@/constants/application.ts";
import type { KaedeNamespaceType } from "@/declarations.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { formatHookError } from "@/lib/hooks/format-hook-error.ts";
import { handleHookResponse } from "@/lib/hooks/handle-hook-response.ts";
import { log } from "@/lib/logging/log.ts";
import type { ExtensionStatusType, HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export function catchSyncResponseHooks<T>({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof KaedeNamespaceType["hooks"];
  "toPass": unknown;
  "timing": "before" | "after";
}): "continue" | T | undefined {
  const currentScopeHooks = getHooks()[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks = currentScopeHooks[timing] as HookReturnType<unknown, unknown, "non-promise">;

  if (hooks.length === 0) {
    return HookResponseStatus.Continue;
  }

  const timeMeasurementStartBefore = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.start(
    scope,
    timing,
    hooks.length,
  ));
  for (const [index, hook] of hooks.entries()) {
    const timeMeasurementStartHook = performance.now();
    let status: ExtensionStatusType;
    let response: T | undefined;

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.execution(
      scope,
      timing,
      index,
      "sync",
    ));
    try {
      const data = hook(toPass) as {
        "status"  : ExtensionStatusType;
        "response": T | undefined;
      };

      status = data.status;
      response = data.response;
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Caught an error while executing hook for '${scope}.${timing}':`,
        formatHookError(error),
      );

      continue;
    }

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
