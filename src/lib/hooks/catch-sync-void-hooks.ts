import type { KaedeNamespaceType } from "@/declarations.ts";
import { getHooks } from "@/extendable/hooks-registry.ts";
import { formatHookError } from "@/lib/hooks/format-hook-error.ts";
import { log } from "@/lib/logging/log.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

export function catchSyncVoidHooks({
  scope,
  toPass,
  timing,
}: {
  "scope" : keyof KaedeNamespaceType["hooks"];
  "toPass": unknown;
  "timing": "before" | "after";
}): void {
  const currentScopeHooks = getHooks()[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks = currentScopeHooks[timing] as HookReturnType<unknown, "nothing", "non-promise">;

  if (hooks.length === 0) {
    return;
  }

  const timeMeasurementStartAfter = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.start(
    scope,
    timing,
    hooks.length,
  ));
  for (const [index, hook] of hooks.entries()) {
    const timeMeasurementStartHook = performance.now();

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.execution(
      scope,
      timing,
      index,
      "sync",
    ));
    try {
      hook(toPass);
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Caught an error while executing hook for '${scope}.${timing}':`,
        formatHookError(error),
      );

      continue;
    }

    const timeMeasurementEndHook = performance.now();
    const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate["no-response"](
      scope,
      timing,
      index,
      currentAfterHookTime,
      "sync",
    ));
  }

  const timeMeasurementEndAfter = performance.now();
  const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

  log.debug(__PRE_BUNDLED_FILENAME__, log.templates.hooks.iterate.end(
    scope,
    timing,
    afterHooksTime,
  ));
}
