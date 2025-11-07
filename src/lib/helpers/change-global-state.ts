import { nextTick } from "vue";

import { ApplicationNamespace } from "@/constants/application.ts";
import { HookMappings } from "@/constants/mappings.ts";
import { log } from "@/lib/handlers/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

export function changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
  setValue: (key: Key, value: GlobalStatesType[Key]) => void,
): void {
  const timeMeasurementStartBefore = performance.now();
  const mappedKey = HookMappings[key];
  const beforeHooks = window[ApplicationNamespace].hooks[mappedKey].before;
  const afterHooks = window[ApplicationNamespace].hooks[mappedKey].after;

  // Global states have not changed yet
  log.debug(
    `Starting iterating through hooks for '${mappedKey}.before'.`,
    `Array length: ${beforeHooks.length}`,
  );
  for (const [index, storedFunction] of beforeHooks.entries()) {
    const timeMeasurementStartHook = performance.now();
    const hook = storedFunction as (anything: unknown) => unknown;

    log.debug(`'${mappedKey}.before' iterate: '${index}' index. Hook execution`);
    const { status, response } = hook(value) as {
      "status"  : ExtensionStatusType;
      "response": GlobalStatesType[Key] | undefined;
    };
    const timeMeasurementEndHook = performance.now();
    const currentBeforeHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

    log.debug(
      `'${mappedKey}.before' iterate: '${index}' index.`,
      `Hook execution ended in ${currentBeforeHookTime}ms.`,
      `Hook response: ${JSON.stringify({ status, response }, null, 2)}`,
    );

    if (status === "stop") {
      if (response !== undefined) {
        setValue(key, response);
      }

      return;
    }
  }

  const timeMeasurementEndBefore = performance.now();
  const beforeHooksTime = timeMeasurementEndBefore - timeMeasurementStartBefore;

  log.debug(`All '${mappedKey}.before' hooks were executed in ${beforeHooksTime}ms`);
  log.debug(`Changing global state. Key: ${key}; value: ${JSON.stringify(value, null, 2)}`);
  setValue(key, value);

  nextTick().then(async () => {
    const timeMeasurementStartAfter = performance.now();

    // Global states have changed now
    log.debug(
      `Starting iterating through hooks for '${mappedKey}.after'.`,
      `Array length: ${afterHooks.length}`,
    );
    for (const [index, storedFunction] of afterHooks.entries()) {
      const timeMeasurementStartHook = performance.now();
      const hook = storedFunction as (anything: unknown) => Promise<unknown>;

      log.debug(`'${mappedKey}.before' iterate: '${index}' index. Async hook execution`);
      await hook(value);

      const timeMeasurementEndHook = performance.now();
      const currentBeforeHookTime = timeMeasurementEndHook - timeMeasurementStartHook;

      log.debug(
        `'${mappedKey}.before' iterate: '${index}' index.`,
        `Async hook executed in ${currentBeforeHookTime}ms`,
      );
    }

    const timeMeasurementEndAfter = performance.now();
    const afterHooksTime = timeMeasurementEndAfter - timeMeasurementStartAfter;

    log.debug(`All '${mappedKey}.after' hooks were executed in ${afterHooksTime}ms`);
  });
}