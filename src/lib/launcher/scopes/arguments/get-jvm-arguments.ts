import ExtensionsManager from "@/lib/extensions-manager";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export async function getJvmArguments({
  instanceId,
  necessaries,
  versionMeta,
  parsed,
}: {
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
}): Promise<string> {
  const jvmArguments: Array<string> = [];

  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { jvmArguments, instanceId, necessaries, versionMeta, parsed },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { platform } = necessaries;

  jvmArguments.push(
    "-Xms1G",
    "-Xmx8G",
    "-Djava.library.path=${natives_directory}",
    "-Djna.tmpdir=${natives_directory}",
    "-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}",
    "-Dio.netty.native.workdir=${natives_directory}",
    "-Dminecraft.launcher.brand=${launcher_name}",
    "-Dminecraft.launcher.version=${launcher_version}",
    "-Duser.language=en",
  );

  let logFilePath: string = "";

  switch (platform) {
    case "windows": {
      if (parsed.logging) {
        logFilePath = "file:///" + parsed.logging.path;
      }

      jvmArguments.push(
        "-XX:HeapDumpPath=" +
        "MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
      );

      break;
    }
    case "macos": {
      if (parsed.logging) {
        logFilePath = parsed.logging.path;
      }

      jvmArguments.push("-XstartOnFirstThread");

      break;
    }
    default: {
      if (parsed.logging) {
        logFilePath = parsed.logging.path;
      }

      break;
    }
  }

  if (parsed.logging) {
    const loggingArguments = parsed
      .logging
      .argument
      .replace(
        "${path}",
        logFilePath,
      );

    jvmArguments.push(loggingArguments);
  }

  const afterHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { jvmArguments, instanceId, necessaries, versionMeta, parsed },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return jvmArguments.join(" ");
}
