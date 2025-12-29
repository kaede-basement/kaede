import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

export type PreLaunchInformationType = {
  "statuses"   : LauncherStatusesType;
  "platform"   : "windows" | "macos" | "linux";
  "arch"       : "x64" | "x86" | "arm64" | "arm32";
  "instance"   : InstanceStateType;
  "javaMajor"  : number;
  "directories": {
    "base"        : string;
    "instance"    : string;
    "assets"      : string;
    "logging"     : string;
    "libraries"   : string;
    "natives"     : string;
    "assetIndexes": string;
    "assetObjects": string;
  };
};
