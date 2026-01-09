import type { ShallowReactive } from "vue";

import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { PatchUIDType } from "@/types/launcher/meta/patch-meta.type.ts";

export type InstanceStateType = GlobalStatesType["minecraft"] & {
  "name"    : string;
  "version" : string;
  "checksum": boolean;
  "entry"   : PatchUIDType;
};

/* Per-instance Minecraft settings */
export type InstanceStatesType = Record<string, InstanceStateType>;

export type InstanceStatesChangerType = <Key extends keyof InstanceStatesType>(
  key  : Key,
  value: InstanceStatesType[Key],
) => void;
export type ContextInstanceStatesType = ShallowReactive<InstanceStatesType>;
