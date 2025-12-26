import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";

export function onInstanceStateChange<Key extends keyof InstanceStatesType>(
  key: Key,
  value: InstanceStatesType[Key],
): void {
  console.log(key, value);
}
