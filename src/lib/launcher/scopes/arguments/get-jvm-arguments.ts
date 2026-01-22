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
}): Promise<Array<string>> {
  const jvmArguments: Array<string> = [];

  const beforeHooksResult: "continue" | Array<string> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { jvmArguments, necessaries, finalizedPatch },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  const { platform, logPrefix } = necessaries;

  log.debug(logPrefix, "Adding default JVM arguments");
  jvmArguments.push(
    "-Xmx4096m",
    "-Dlog4j2.formatMsgNoLookups=true",
    "-Djava.net.useSystemProxiestrue",
    "-Dfml.ignoreInvalidMinecraftCertificates=true",
    "-Dfml.ignorePatchDiscrepancies=true",
    "-DlibraryDirectory=${libraries_directory}",
    "-Djava.library.path=${natives_directory}",
    "-Dminecraft.client.jar=${main_jar_directory}",
    "-Djna.tmpdir=${natives_directory}",
    "-Dorg.lwjgl.system.SharedLibraryExtractPath=${natives_directory}",
    "-Dio.netty.native.workdir=${natives_directory}",
    "-Dminecraft.launcher.brand=${launcher_name}",
    "-Dminecraft.launcher.version=${launcher_version}",
    "-Duser.language=en",
    ...finalizedPatch["+jvmArgs"],
  );

  let logFilePath: string = "";

  switch (platform) {
    case "windows": {
      log.debug(logPrefix, "Adding Windows-only JVM arguments");

      if (version().slice(0, 2) === "10") {
        log.debug(logPrefix, "Adding Windows 10 specific JVM arguments");
        jvmArguments.push(
          "-Dos.name=Windows 10",
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
      log.debug(logPrefix, "Adding macOS-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      jvmArguments.push("-XstartOnFirstThread");

      break;
    }
    default: {
      log.debug(logPrefix, "Adding Linux-only JVM arguments");

      if (finalizedPatch.logging) {
        logFilePath = finalizedPatch.logging.path;
      }

      break;
    }
  }

  if (finalizedPatch.logging) {
    log.debug(logPrefix, "Adding logging config to JVM arguments");
    const loggingArguments = finalizedPatch
      .logging
      .argument
      .replace(
        "${path}",
        logFilePath,
      );

    jvmArguments.push(loggingArguments);
  }

  const afterHooksResult: "continue" | Array<string> | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<Array<string>>({
      "scope" : "onJVMArgumentsGet",
      "toPass": { necessaries, finalizedPatch },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  return jvmArguments;
}
