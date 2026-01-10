<script setup lang="ts">
import { platform } from "@tauri-apps/plugin-os";
import { type Child, Command } from "tauri-plugin-shellx-api";
import { markRaw, provide, reactive, ref } from "vue";

import {
  ApplicationNamespace,
  AuthStatesContextKey, CloseInstanceContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { LaunchResponseType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const accounts = ref<Array<AccountType>>(
  window[ApplicationNamespace].__internals.temporaryAccounts,
);
const launches = reactive<Record<string, LauncherStatusesType>>({});

const childProcesses: Record<string, Child> = {};

// Do not expose accounts data to globals since extensions will easily access it
window[ApplicationNamespace].__internals.temporaryAccounts = [];

function onClose(instanceId: string): void {
  const statuses: LauncherStatusesType = launches[instanceId];

  statuses.launching = 0;
}

async function launchInstance(instanceId?: string): Promise<void> {
  if (!instanceId) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The instance launch button was pressed but no instance is present",
    );

    return;
  }

  const currentInstances: InstanceStatesType = Instances.get();
  const currentInstance: CurrentInstanceType = Instances.findCurrent(
    instanceId,
    currentInstances,
  );

  if (!currentInstance || !currentInstance.instance) {
    log.error(__PRE_BUNDLED_FILENAME__, "No current instance found");

    return;
  }

  launches[instanceId] = {
    "launching": 1,
    "current"  : undefined,
    "downloads": markRaw({
      "current": new Map<string, number>,
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    }),
  };

  const statuses: LauncherStatusesType = launches[instanceId];
  const startTime: number = performance.now();

  statuses.current = LaunchStatus.General.Starting;

  try {
    const javaMajor: number = window[ApplicationNamespace].__internals.javaMajor
      ?? await General.getJavaMajor();
    const { success, process }: LaunchResponseType = await Launcher.handleLaunch({
      "instance"       : currentInstance.instance,
      "userPreferences": {
        "javaBinary": "java",
        "javaMajor" : javaMajor,
        "versions"  : {
          "net.minecraft": currentInstance.instance.version,
          "net.neoforged": "20.4.2-beta",
          // 36.2.42 for 1.16.5, 61.0.5 for 1.21.11
          "net.minecraftforge": currentInstance.instance.version === "1.20.4"
            ? "49.2.0"
            : "36.2.42",
          "com.mumfrey.liteloader"   : currentInstance.instance.version,
          "net.fabricmc.intermediary": currentInstance.instance.version,
        },
      },
      instanceId,
      statuses,
      onClose,
    });

    statuses.launching = success ? 2 : 0;

    if (process !== undefined) {
      childProcesses[instanceId] = process;
    }
  } catch (error: unknown) {
    statuses.launching = 0;
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Unhandled error.",
      `Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${instanceId}' launch process was done in ${totalTime} ms.`,
    `Is success: '${statuses.launching === 2}'`,
  );
}
async function closeInstance(instanceId: string): Promise<void> {
  const process: {
    "pid" : number;
    "kill": () => Promise<void>;
  } | undefined = childProcesses[instanceId];

  if (!process) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `The '${instanceId}' instance kill action was called but no process is present`,
    );

    return;
  }

  const beforeHooksResult: "continue" | void | undefined =
    await ExtensionsManager.catchAsyncResponseHooks<void>({
      "scope" : "onMinecraftKill",
      "toPass": process,
      "timing": "before",
    });

  if (beforeHooksResult !== "continue") {
    return;
  }

  // Refer to https://github.com/tauri-apps/tauri/issues/4949
  if (platform() === "windows") {
    await Command.create("cmd", `/C taskkill /pid ${process.pid} /f /t`).execute();

    return;
  }

  await process.kill();
  await ExtensionsManager.catchAsyncVoidHooks({
    "scope" : "onMinecraftKill",
    "toPass": process.pid,
    "timing": "after",
  });
}

/*
 * AFAIK, even unrestricted extensions should not be able to access this context
 * although they can still just read the 'accounts.json' file
 * or do whatever they want in the system.
 */
provide<WrappedAccountsType>(AuthStatesContextKey, accounts);

/*
 * Provide multiple instance launch statuses
 */
provide<WrappedInstanceLauncherStatusesType>(LaunchStatesContextKey, launches);
provide<(instanceId?: string) => Promise<void>>(LaunchInstanceContextKey, launchInstance);
provide<(instanceId: string) => Promise<void>>(CloseInstanceContextKey, closeInstance);
</script>

<template>
  <slot />
</template>
