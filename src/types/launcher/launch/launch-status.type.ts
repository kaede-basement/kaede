import type { Raw, Reactive } from "vue";

import type { LaunchStatus } from "@/constants/launcher.ts";

type LaunchStatusObjectType = typeof LaunchStatus;
type LaunchKeyType = keyof LaunchStatusObjectType;

export type LaunchStatusType = {
  [Key in LaunchKeyType]: LaunchStatusObjectType[Key][keyof LaunchStatusObjectType[Key]];
}[LaunchKeyType];

export type LauncherStatusesType = {
  "launching": 0 | 1 | 2;
  "current"  : LaunchStatusType | undefined;
  "downloads": Set<string>;
};
export type WrappedInstanceLauncherStatusesType = Reactive<
  Record<
    string,
    {
      "launching": LauncherStatusesType["launching"];
      "current"  : LauncherStatusesType["current"];
      "downloads": Raw<Set<string>>;
    }
  >
>;
