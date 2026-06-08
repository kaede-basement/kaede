import { nextTick } from "vue";

import { HookMappings } from "@/constants/hooks.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import { globalStates } from "@/states/global.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

/**
 * Changes a specified field in the global states with the provided value
 * while handling all attached hooks.
 *
 * @param key   - A one-level deep key of a global states object,
 *                e.g. 'development', 'extensions', or 'layout'.
 * @param value - A value that is stored in a field with the provided key.
 */
export function changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
): void {
  const mappedKey = HookMappings[key];
  const hooksResult: "continue" | GlobalStatesType[Key] | undefined =
    ExtensionsManager.catchSyncResponseHooks<GlobalStatesType[Key]>({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    globalStates[key] = value;

    return;
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Changing the global state.",
    `Key: ${key};`,
    `value: \n${JSON.stringify(value, null, 2)}`,
  );
  globalStates[key] = value;

  nextTick().then(async () => {
    await ExtensionsManager.catchAsyncVoidHooks({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "after",
    });

    ExtensionsManager.onGlobalStateChange(key, value);
  });
}
