import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { HookReturnType } from "@/types/extensions/hook-return.type.ts";
import IsKeyInObject from "@/types/utils/is-key-in-object.ts";

const timing = "after";

export async function catchAsyncAfterHooks({
  scope,
  toPass,
}: {
  "scope" : keyof (Window[typeof ApplicationNamespace]["hooks"]);
  "toPass": unknown;
}): Promise<void> {
  const timeMeasurementStartAfter = performance.now();
  const currentScopeHooks = window[ApplicationNamespace].hooks[scope];

  if (!IsKeyInObject(timing, currentScopeHooks)) {
    return;
  }

  const hooks: HookReturnType<unknown, unknown> = currentScopeHooks[timing];

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
      "async",
    ));
    await hook(toPass);

    const timeMeasurementEndHook = performance.now();
    const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(log.templates.hooks.iterate["no-response"](
      scope,
      timing,
      index,
      currentAfterHookTime,
      "async",
    ));
  }

  const timeMeasurementEndAfter = performance.now();
  const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

  log.debug(log.templates.hooks.iterate.end(
    scope,
    timing,
    afterHooksTime,
  ));
}
