import type { ShallowReactive } from "vue";

import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { PatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export type InstanceStateType = GlobalStatesType["minecraft"] & {
  "name"         : string;
  "checksum"     : boolean;
  "playTime"     : number;
  "entry"        : PatchUIDType;
  "patchVersions": {
    "net.minecraft": string;
  } & Partial<
    Record<PatchUIDType, string>
  >;
};

/* Per-instance Minecraft settings */
export type InstanceStatesType = Record<string, InstanceStateType>;

export type InstanceStatesChangerType = <Key extends keyof InstanceStatesType>(
  key  : Key,
  value: InstanceStatesType[Key],
) => void;
export type ContextInstanceStatesType = ShallowReactive<InstanceStatesType>;
