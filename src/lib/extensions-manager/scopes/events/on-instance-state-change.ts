import { handleEvent } from "@/lib/extensions-manager/scopes/handle-event.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export function onInstanceStateChange<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
): void {
  handleEvent("instance", {
    key,
    value,
  });
}
