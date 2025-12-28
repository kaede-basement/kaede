import { type Arch, arch, type Platform, platform } from "@tauri-apps/plugin-os";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import Instances from "@/lib/instances";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";

export function extractPreLaunchInformation({
  statuses,
  instance,
  instanceId,
}: {
  "statuses"  : LauncherStatusesType;
  "instance"  : InstanceStateType;
  "instanceId": string;
}): PreLaunchInformationType | false {
  const beforeHooksResult: "continue" | PreLaunchInformationType | false | undefined =
    ExtensionsManager.catchSyncResponseHooks<PreLaunchInformationType | false>({
      "scope" : "onPreLaunchInformation",
      "toPass": { statuses, instanceId },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const providedPlatform: Platform = platform();
  const providedArch: Arch = arch();

  let compatiblePlatform: PreLaunchInformationType["platform"];
  let compatibleArch: PreLaunchInformationType["arch"];

  const baseDirectory: string = General.getCachedBaseDirectory();
  const instanceDirectory: string = Instances.getMinecraftDirectory({
    baseDirectory,
    instanceId,
  });
  const assetsDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
  );
  const loggingDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Assets.Path,
    FileStructure.Folders.Assets.Folders.LogConfigs.Path,
  );
  const librariesDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Libraries.Path,
  );
  const nativesDirectory: string = General.cachedJoin(
    baseDirectory,
    FileStructure.Folders.Instances.Path,
    instanceId,
    FileStructure.Folders.Instances.Folders._Entry_.Folders.Natives.Path,
  );

  switch (providedPlatform) {
    case "linux":
    case "windows":
    case "macos": {
      compatiblePlatform = providedPlatform;

      break;
    }
    default: {
      statuses.current = LaunchStatus.Errors.IncompatiblePlatform;

      return false;
    }
  }

  switch (providedArch) {
    case "x86": {
      compatibleArch = "x86";

      break;
    }
    case "x86_64": {
      compatibleArch = "x64";

      break;
    }
    case "arm": {
      compatibleArch = "arm32";

      break;
    }
    case "aarch64":
    case "riscv64": {
      compatibleArch = "arm64";

      break;
    }
    default: {
      statuses.current = LaunchStatus.Errors.IncompatibleArch;

      return false;
    }
  }

  const preLaunchInformation: PreLaunchInformationType = {
    statuses,
    "platform"   : compatiblePlatform,
    "arch"       : compatibleArch,
    "instance"   : instance,
    "directories": {
      "base"     : baseDirectory,
      "instance" : instanceDirectory,
      "assets"   : assetsDirectory,
      "logging"  : loggingDirectory,
      "libraries": librariesDirectory,
      "natives"  : nativesDirectory,
    },
  };
  const afterHooksResult: "continue" | PreLaunchInformationType | false | undefined =
    ExtensionsManager.catchSyncResponseHooks<PreLaunchInformationType | false>({
      "scope" : "onPreLaunchInformation",
      "toPass": preLaunchInformation,
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return preLaunchInformation;
}
