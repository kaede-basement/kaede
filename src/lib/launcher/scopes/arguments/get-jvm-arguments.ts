import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getJvmArguments({
  client,
  necessaries,
  versionMeta,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : MappedArtifactType & {
      "argument": string;
    };
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
}): Promise<string> {
  const { directories, platform } = necessaries;
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

  switch (platform) {
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

  if (!versionMeta.logging) {
    return jvmArguments.join(" ");
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
