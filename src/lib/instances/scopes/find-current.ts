import type {
  InstanceStatesType,
  InstanceStateType,
} from "@/types/application/instance-states.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/current-instance.type.ts";

export function findCurrent(
  id: string | null | undefined,
  instances: InstanceStatesType | undefined,
): CurrentInstanceType {
  if (!id) {
    return;
  }

  const instance: InstanceStateType | undefined = instances?.[id];

  if (!instance) {
    return undefined;
  }

  return { instance, id };
}