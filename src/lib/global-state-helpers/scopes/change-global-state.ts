import { nextTick } from "vue";

import { ApplicationNamespace } from "@/constants/application.ts";
import { HookMappings } from "@/constants/hooks.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

export function __changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
  setValue: (key: Key, value: GlobalStatesType[Key]) => void,
): void {
  const timeMeasurementStartBefore = performance.now();
  const mappedKey = HookMappings[key];
  const beforeHooks = window[ApplicationNamespace].hooks[mappedKey].before;
  const afterHooks = window[ApplicationNamespace].hooks[mappedKey].after;

  // Global states have not changed yet
  log.debug(log.templates.hooks.iterate.start(
    mappedKey,
    "before",
    beforeHooks.length,
  ));
  for (const [index, storedFunction] of beforeHooks.entries()) {
    const timeMeasurementStartHook = performance.now();
    const hook = storedFunction as (anything: unknown) => unknown;

    log.debug(log.templates.hooks.iterate.execution(
      mappedKey,
      "before",
      index,
      "sync",
    ));
    const { status, response } = hook(value) as {
      "status"  : ExtensionStatusType;
      "response": GlobalStatesType[Key] | undefined;
    };
    const timeMeasurementEndHook = performance.now();
    const currentBeforeHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(log.templates.hooks.iterate.response(
      mappedKey,
      { status, response },
      "before",
      index,
      currentBeforeHookTime,
    ));

    if (status === "stop") {
      if (response !== undefined) {
        setValue(key, response);
      }

      return;
    }
  }

  const timeMeasurementEndBefore = performance.now();
  const beforeHooksTime = timeMeasurementEndBefore - timeMeasurementStartBefore;

  log.debug(log.templates.hooks.iterate.end(
    mappedKey,
    "before",
    beforeHooksTime,
  ));
  log.debug(`Changing global state. Key: ${key}; value: \n${JSON.stringify(value, null, 2)}`);
  setValue(key, value);

  nextTick().then(async () => {
    const timeMeasurementStartAfter = performance.now();

    // Global states have changed now
    log.debug(log.templates.hooks.iterate.start(
      mappedKey,
      "after",
      afterHooks.length,
    ));
    for (const [index, storedFunction] of afterHooks.entries()) {
      const timeMeasurementStartHook = performance.now();
      const hook = storedFunction as (anything: unknown) => Promise<unknown>;

      log.debug(log.templates.hooks.iterate.execution(
        mappedKey,
        "after",
        index,
        "async",
      ));
      await hook(value);

      const timeMeasurementEndHook = performance.now();
      const currentAfterHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

      log.debug(log.templates.hooks.iterate["no-response"](
        mappedKey,
        "after",
        index,
        currentAfterHookTime,
        "async",
      ));
    }

    const timeMeasurementEndAfter = performance.now();
    const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

    log.debug(log.templates.hooks.iterate.end(
      mappedKey,
      "after",
      afterHooksTime,
    ));

    ExtensionsManager.onGlobalStateChange(key, value);
  });
}