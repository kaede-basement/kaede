import type { LaunchStatus } from "@/constants/launcher.ts";

type LaunchStatusObjectType = typeof LaunchStatus;
type LaunchKeyType = keyof LaunchStatusObjectType;

export type LaunchStatusType = {
  [Key in LaunchKeyType]: LaunchStatusObjectType[Key][keyof LaunchStatusObjectType[Key]];
}[LaunchKeyType];
