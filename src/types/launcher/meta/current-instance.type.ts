import type { InstanceStateType } from "@/types/application/instance-states.type.ts";

export type CurrentInstanceType = {
  "instance": InstanceStateType;
  "id"      : string;
} | undefined;