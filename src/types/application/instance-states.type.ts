import type { ShallowReactive } from "vue";

import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

/* Per-instance Minecraft settings */
export type InstanceStatesType = Record<string, GlobalStatesType["minecraft"]>;

export type InstanceStatesChangerType = <Key extends keyof InstanceStatesType>(
  key  : Key,
  value: InstanceStatesType[Key],
) => void;
export type ContextInstanceStatesType = ShallowReactive<InstanceStatesType>;