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
    ExtensionsManager.catchBeforeHooks<GlobalStatesType[Key]>({
      "scope" : mappedKey,
      "toPass": value,
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
    await ExtensionsManager.catchAsyncAfterHooks({
      "scope" : mappedKey,
      "toPass": value,
    });

    ExtensionsManager.onGlobalStateChange(key, value);
  });
}
