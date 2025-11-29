import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";

export function findCurrent(
  instances: InstanceStatesType | undefined,
): InstanceStateType | undefined {
  const keys = Object.keys(instances ?? {});

  if (keys.length === 0) {
    return undefined;
  }

  return instances?.[keys?.[0]];
}