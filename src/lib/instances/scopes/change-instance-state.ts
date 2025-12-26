import { nextTick } from "vue";

import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export function __changeInstanceState<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
  setValue: (key: Key, value: InstanceStatesType[Key]) => void,
): void {
  const hooksResult: "continue" | InstanceStatesType[Key] | undefined =
    ExtensionsManager.catchBeforeHooks<InstanceStatesType[Key]>({
      "scope" : "onInstanceChange",
      "toPass": value,
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    setValue(key, hooksResult);

    return;
  }

  log.debug(
    "Changing instance state.",
    `Key: ${key};`,
    `value: \n${JSON.stringify(value, null, 2)}`,
  );
  setValue(key, value);

  nextTick().then(async () => {
    await ExtensionsManager.catchAsyncAfterHooks({
      "scope" : "onInstanceChange",
      "toPass": value,
    });

    ExtensionsManager.onInstanceStateChange(key, value);
  });
}
