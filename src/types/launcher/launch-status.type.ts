import type { LaunchStatus } from "@/constants/launcher.ts";

type LaunchStatusObjectType = typeof LaunchStatus;
type LaunchKeyType = keyof LaunchStatusObjectType;

export type LaunchStatusType = {
  [Key in LaunchKeyType]: LaunchStatusObjectType[Key][keyof LaunchStatusObjectType[Key]];
}[LaunchKeyType];

export type LauncherStatusesType = {
  "current"  : LaunchStatusType | undefined;
  "assets"   : Set<string>;
  "libraries": Set<string>;
};
