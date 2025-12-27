import { type Arch, arch, type Platform, platform } from "@tauri-apps/plugin-os";

import { FileStructure } from "@/constants/file-structure.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import Instances from "@/lib/instances";
import { extractInstance } from "@/lib/launcher/scopes/extract-instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch-status.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

export function extractPreLaunchInformation({
  statuses,
  instanceId,
}: {
  "statuses"  : LauncherStatusesType;
  "instanceId": string;
}): PreLaunchInformationType | false {
  ExtensionsManager.catchBeforeHooks({
    "scope" : "onPreLaunchInformation",
    "toPass": { statuses, instanceId },
  });

  const providedPlatform: Platform = platform();
  const providedArch: Arch = arch();

  let compatiblePlatform: PreLaunchInformationType["platform"];
  let compatibleArch: PreLaunchInformationType["arch"];

  const baseDirectory: string = General.getCachedBaseDirectory();
  const instanceDirectory: string = Instances.getMinecraftDirectory({
    baseDirectory,
    instanceId,
  });
  const instance: InstanceStateType | undefined = extractInstance({
    statuses,
    instanceId,
  });

  if (instance === undefined) {
    return false;
  }

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

  switch (providedPlatform) {
    case "linux":
    case "windows":
    case "macos": {
      compatiblePlatform = providedPlatform;

      break;
    }
    default: {
      statuses.add(LaunchStatus.Errors.IncompatiblePlatform);

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
      statuses.add(LaunchStatus.Errors.IncompatibleArch);

      return false;
    }
  }

  //

  return {
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
    },
  };
}
