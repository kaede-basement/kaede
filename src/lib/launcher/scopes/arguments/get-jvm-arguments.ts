import { version } from "@tauri-apps/plugin-os";

import ExtensionsManager from "@/lib/extensions-manager";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { FinalizedPatchType } from "@/types/launcher/patch/finalized-patch.type.ts";

export async function getJvmArguments({
  necessaries,
  finalizedPatch,
}: {
  "necessaries"   : PreLaunchInformationType;
  "finalizedPatch": FinalizedPatchType;
}): Promise<string> {
  const jvmArguments: Array<string> = [];

  const beforeHooksResult: "continue" | string | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<string>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { jvmArguments, necessaries, finalizedPatch, },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { platform } = necessaries;

  log.debug(__PRE_BUNDLED_FILENAME__, "Adding default JVM arguments");
  jvmArguments.push(
    "-Xms1G",
    "-Xmx6G",
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
      log.debug(__PRE_BUNDLED_FILENAME__, "Adding Windows-only JVM arguments");

      if (version().slice(0, 2) === "10") {
        log.debug(__PRE_BUNDLED_FILENAME__, "Adding Windows 10 specific JVM arguments");
        jvmArguments.push(
          // "-Dos.name=\"Windows 10\"", // broken even with quotes around command instead value
          "-Dos.version=10.0",
        );
      }

      if (finalizedPatch.logging) {
        logFilePath = "file:///" + finalizedPatch.logging.path;
      }

      jvmArguments.push(
        "-XX:HeapDumpPath=" +
        "MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump",
      );

      break;
    }
    case "macos": {
      log.debug(__PRE_BUNDLED_FILENAME__, "Adding macOS-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      jvmArguments.push("-XstartOnFirstThread");

      break;
    }
    default: {
      log.debug(__PRE_BUNDLED_FILENAME__, "Adding Linux-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      break;
    }
  }

  if (finalizedPatch.logging) {
    log.debug(__PRE_BUNDLED_FILENAME__, "Adding logging config to JVM arguments");
    const loggingArguments = finalizedPatch
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
      "toPass": { necessaries, finalizedPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return jvmArguments.join(" ");
}
