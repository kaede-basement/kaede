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
    ExtensionsManager.catchSyncResponseHooks<InstanceStatesType[Key]>({
      "scope" : "onInstanceChange",
      "toPass": value,
      "timing": "before",
    });

  if (hooksResult !== "continue" && hooksResult !== undefined) {
    setValue(key, hooksResult);

    return;
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Changing instance state.",
    `Key: ${key};`,
    `value: \n${JSON.stringify(value, null, 2)}`,
  );
  setValue(key, value);

  nextTick().then(async () => {
    await ExtensionsManager.catchAsyncVoidHooks({
      "scope" : "onInstanceChange",
      "toPass": value,
      "timing": "after",
    });

    ExtensionsManager.onInstanceStateChange(key, value);
  });
}
