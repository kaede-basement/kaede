import type { Platform } from "@tauri-apps/plugin-os";

import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { DirectoriesType } from "@/types/launcher/launch/directories.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export function getJvmArguments({
  instance,
  currentPlatform,
  versionMeta,
  directories,
}: {
  "instance"       : InstanceStateType;
  "currentPlatform": Platform;
  "versionMeta"    : MetaMinecraftVersionType;
  "directories"    : DirectoriesType;
}): string {
  const isNew: boolean = versionMeta?.minecraftArguments === undefined;
  const jvmArguments: Array<string> = [];

  if (!isNew) {
    jvmArguments.push(
      "-Djava.library.path=${natives_directory}",
      "-Djna.tmpdir=${natives_directory}",
      "-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}",
      "-Dio.netty.native.workdir=${natives_directory}",
      "-Dminecraft.launcher.brand=${launcher_name}",
      "-Dminecraft.launcher.version=${launcher_version}",
    );
  }

  let logFilePath: string;

  switch (currentPlatform) {
    case "windows": {
      logFilePath = "file:///%SystemDrive%" + directories.logging.slice(2);

      if (!isNew) {
        jvmArguments.push(
          "-XX:HeapDumpPath=" +
          "MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
        );
      }

      break;
    }
    case "macos": {
      logFilePath = directories.logging;

      if (!isNew) {
        jvmArguments.push("-XstartOnFirstThread");
      }

      break;
    }
    default: {
      logFilePath = directories.logging;

      break;
    }
  }

  const loggingArguments = versionMeta
    .logging
    .argument
    .replace(
      "${path}",
      logFilePath,
    );

  jvmArguments.push(loggingArguments);

  return jvmArguments.join(" ");
}
