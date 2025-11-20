import { nextTick } from "vue";

import { ApplicationNamespace } from "@/constants/application.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

export function __changeInstanceState<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
  setValue: (key: Key, value: InstanceStatesType[Key]) => void,
): void {
  const timeMeasurementStartBefore = performance.now();
  const beforeHooks = window[ApplicationNamespace].hooks.onInstanceChange.before;
  const afterHooks = window[ApplicationNamespace].hooks.onInstanceChange.after;

  // Instance states have not changed yet
  log.debug(log.templates.hooks.iterate.start(
    "onInstanceChange",
    "before",
    beforeHooks.length,
  ));
  for (const [index, hook] of beforeHooks.entries()) {
    const timeMeasurementStartHook = performance.now();

    log.debug(log.templates.hooks.iterate.execution(
      "onInstanceChange",
      "before",
      index,
      "sync",
    ));
    const { status, response } = hook({ key, value }) as {
      "status"  : ExtensionStatusType;
      "response": {
        "key"  : Key;
        "value": InstanceStatesType[Key];
      } | undefined;
    };
    const timeMeasurementEndHook = performance.now();
    const currentBeforeHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(log.templates.hooks.iterate.response(
      "onInstanceChange",
      { status, response },
      "before",
      index,
      currentBeforeHookTime,
    ));

    if (status === "stop") {
      if (response !== undefined) {
        setValue(response.key, response.value);
      }

      return;
    }
  }

  const timeMeasurementEndBefore = performance.now();
  const beforeHooksTime = timeMeasurementEndBefore - timeMeasurementStartBefore;

  log.debug(log.templates.hooks.iterate.end(
    "onInstanceChange",
    "before",
    beforeHooksTime,
  ));
  log.debug(`Changing instance state. Key: ${key}; value: \n${JSON.stringify(value, null, 2)}`);
  setValue(key, value);

  nextTick().then(async () => {
    const timeMeasurementStartAfter = performance.now();

    // Global states have changed now
    log.debug(log.templates.hooks.iterate.start(
      "onInstanceChange",
      "after",
      afterHooks.length,
    ));
    for (const [index, hook] of afterHooks.entries()) {
      const timeMeasurementStartHook = performance.now();

      log.debug(log.templates.hooks.iterate.execution(
        "onInstanceChange",
        "after",
        index,
        "async",
      ));
      await hook({ key, value });

      const timeMeasurementEndHook = performance.now();
      const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

      log.debug(log.templates.hooks.iterate["no-response"](
        "onInstanceChange",
        "after",
        index,
        currentAfterHookTime,
        "async",
      ));
    }

    const timeMeasurementEndAfter = performance.now();
    const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

    log.debug(log.templates.hooks.iterate.end(
      "onInstanceChange",
      "after",
      afterHooksTime,
    ));
  });
}