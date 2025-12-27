import { nextTick } from "vue";

import { HookMappings } from "@/constants/hooks.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function __changeGlobalState<Key extends keyof GlobalStatesType>(
  key: Key,
  value: GlobalStatesType[Key],
  setValue: (key: Key, value: GlobalStatesType[Key]) => void,
): void {
  const mappedKey = HookMappings[key];
  const hooksResult: "continue" | GlobalStatesType[Key] | undefined =
    ExtensionsManager.catchSyncResponseHooks<GlobalStatesType[Key]>({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    setValue(key, hooksResult);

    return;
  }

  log.debug(
    "Changing the global state.",
    `Key: ${key};`,
    `value: \n${JSON.stringify(value, null, 2)}`,
  );
  setValue(key, value);

  nextTick().then(async () => {
    await ExtensionsManager.catchAsyncVoidHooks({
      "scope" : mappedKey,
      "toPass": value,
      "timing": "after",
    });

    ExtensionsManager.onGlobalStateChange(key, value);
  });
}
