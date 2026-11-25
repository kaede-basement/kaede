<script setup lang="ts">
import {
  inject,
  onUnmounted,
  provide,
  reactive,
  shallowReactive,
  shallowRef,
} from "vue";

import {
  AuthOneTimeFetchContextKey,
  AuthStatesContextKey,
  CloseInstanceContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { GeneralSettings, LaunchStatus } from "@/constants/launcher.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Auth from "@/lib/auth";
import Errors from "@/lib/errors";
import Hooks from "@/lib/hooks";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/log.ts";
import { createDownloadMap } from "@/lib/network/download-map.ts";
import { rehydrateProcesses } from "@/lib/processes/core.ts";
import { SpawnObservers } from "@/lib/processes/spawn-process.ts";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import {
  ActiveRuns, commitPlaytime, missingRunHandlers, startPlaytime,
} from "@/states/instance.ts";
import type {
  ProcessHandlersType,
  ProcessHandleType,
} from "@/types/application/server-process.type.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

const accounts = shallowRef(inject<Array<AccountType>>(AuthOneTimeFetchContextKey) ?? []);
const launches = reactive<Record<string, LauncherStatusesType>>({});
const logs = shallowReactive<Record<string, { "list": Array<string>; "dropped": number }>>({});

const pendingLaunches = new Set<string>;

function recordSpawn(handle: ProcessHandleType, startedAt: number): void {
  if (handle.kind !== "minecraft") {
    return;
  }
  const process = handle as MinecraftProcessType;
  const { instanceId } = process.meta;

  if (pendingLaunches.has(instanceId)) {
    startPlaytime(instanceId, process, false, startedAt);
  }
}
SpawnObservers.add(recordSpawn);
onUnmounted(() => SpawnObservers.delete(recordSpawn));

function syncExitedPlaytime(): Promise<void> {
  return Instances.sync().catch(error => log.error(__PRE_BUNDLED_FILENAME__, "Exit sync:", error));
}

function onClose(instanceId: string, endedAt = performance.now()): void {
  const process = ActiveRuns.get(instanceId)?.process;

  if (process) {
    commitPlaytime(instanceId, process.token, endedAt);
  }
  void syncExitedPlaytime();

  launches[instanceId].launching = 0;
  launches[instanceId].current = LaunchStatus.General.Aborted;
  globalStates.logs.show = true;
  globalStates.logs.mode = instanceId;
}

function createLogSink(instanceId: string): (lines: Array<string>) => void {
  const stored: Array<string> = [];

  let dropped = 0;

  // Overwrite the previous launch logs
  logs[instanceId] = { "list": stored, dropped };

  const lineLimit = GeneralSettings.Logs.LineLimit;

  return (lines: Array<string>): void => {
    if (logs[instanceId]?.list !== stored) {
      return;
    }

    for (const line of lines) {
      stored.push(line);
    }

    // Keeps the newest half of logs
    if (stored.length > lineLimit) {
      const trim = stored.length - Math.ceil(lineLimit / 2);

      dropped += trim;
      stored.splice(0, trim);
    }

    logs[instanceId] = { "list": stored, dropped };
  };
}

async function resolveLaunchAccount(): Promise<LaunchAuthType | undefined> {
  const resolved = await Auth.resolveLaunchAccount(accounts.value);

  if (resolved !== undefined) {
    accounts.value = resolved.accounts;
  }

  return resolved?.auth;
}

function launchStatus(instanceId: string, running: boolean): LauncherStatusesType {
  return {
    instanceId,
    "launching": running ? 2 : 1,
    "current"  : running ? LaunchStatus.General.Success : LaunchStatus.General.Starting,
    "downloads": {
      "current": createDownloadMap(),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };
}

const launchInstance: LaunchContextType = async (instanceId, options) => {
  if (!instanceId) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No instance selected for launch");
  }

  if (!await ensureHydrated() || pendingLaunches.has(instanceId) || ActiveRuns.has(instanceId)) {
    return;
  }

  const currentInstance = options?.overridden ?? Instances.findCurrent(instanceId);

  if (!currentInstance?.instance) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No current instance found");
  }

  launches[instanceId] = launchStatus(instanceId, false);
  const statuses = launches[instanceId];

  pendingLaunches.add(instanceId);

  try {
    const onInput = createLogSink(instanceId);

    const cachedMajor = options?.javaPath ? undefined : GlobalInternals.javaMajor;
    const [javaMajor, account] = await Promise.all([
      cachedMajor || Launcher.fetchJavaMajor(options?.javaPath), resolveLaunchAccount(),
    ]);

    const { success, process } = await Launcher.handleLaunch({
      "instance"       : currentInstance.instance,
      "userPreferences": {
        "javaBinary": options?.javaPath ?? currentInstance.instance.javaBinary,
        "javaMajor" : javaMajor,
        "versions"  : currentInstance.instance.patchVersions,
        account,
      },
      instanceId,
      statuses,
      "onClose": () => {
        if (launches[instanceId] === statuses && statuses.launching !== 0) {
          onClose(instanceId);
        }
      },
      onInput,
    });

    if (statuses.launching === 0) {
      statuses.current = LaunchStatus.General.Aborted;
    } else {
      statuses.launching = success ? 2 : 0;
      if (success && process && !ActiveRuns.has(instanceId)) {
        startPlaytime(instanceId, process);
      }
    }
  } catch (error: unknown) {
    statuses.launching = 0;
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Unhandled error. Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }

  pendingLaunches.delete(instanceId);
};

async function closeInstance(instanceId: string): Promise<void> {
  const process = ActiveRuns.get(instanceId)?.process;

  if (!process) {
    return log.error(__PRE_BUNDLED_FILENAME__, `No running process to kill for ${instanceId}`);
  }

  const beforeHooksResult = await Hooks.catchAsyncResponseHooks<void>({
    "scope": "onMinecraftKill", "toPass": process, "timing": "before",
  });

  if (beforeHooksResult !== "continue") {
    return;
  }

  try {
    await process.kill();
    if (ActiveRuns.get(instanceId)?.process.token === process.token) {
      onClose(instanceId);
    }
  } catch (error: unknown) {
    log.error(__PRE_BUNDLED_FILENAME__, `Failed to kill ${instanceId}:`, Errors.prettify(error));
  }
}

function attach(handle: ProcessHandleType, endedAt?: number): ProcessHandlersType | undefined {
  if (handle.kind !== "minecraft") {
    return;
  }

  const process = handle as MinecraftProcessType;
  const { instanceId } = process.meta;

  startPlaytime(instanceId, process, true);
  launches[instanceId] = launchStatus(instanceId, true);

  return {
    "onOutput": createLogSink(instanceId),
    "onExit"  : (payload): void => {
      if (ActiveRuns.get(instanceId)?.process.token === handle.token) {
        onClose(instanceId, endedAt);
      }
      Hooks.catchAsyncVoidHooks({
        "scope" : "onMinecraftKill",
        "toPass": payload.pid,
        "timing": "after",
      });
    },
  };
}

async function rehydrateLaunchedInstances(): Promise<void> {
  await Watchers.watchProcesses();
  const tracked = missingRunHandlers();

  await rehydrateProcesses(attach, (handle, { payload, endedAt }) => {
    attach(handle, endedAt)?.onExit?.(payload);
  }, tracked);
  if (tracked.size > 0) {
    await syncExitedPlaytime();
  }
}
let hydration: Promise<boolean> | undefined;

function ensureHydrated(): Promise<boolean> {
  hydration ??= rehydrateLaunchedInstances().then(() => true)
    .catch(error => {
      hydration = undefined;
      log.error(__PRE_BUNDLED_FILENAME__, "Process rehydration failed:", Errors.prettify(error));

      return false;
    });

  return hydration;
}

void ensureHydrated();

/*
 * AFAIK, even unrestricted extensions should not be able to access this context
 * although they can still just read the 'accounts.json' file
 * or do whatever else they want to do in the system.
 *
 * UPD: with the new capability of Vue instance sharing and using our own component registry,
 * the extensions can simply replace something like 'C.Tabs' to their own
 * component that also tries to inject 'AuthStatesContextKey', which should succeed
 * and provide them a valid array of accounts. Scary? Well, use trusted or sandboxed
 * extensions in such case. Unrestricted untrusted extensions can do way more harm
 * to your system in contrast to simply stealing your Minecraft tokens.
 */
provide<WrappedAccountsType>(AuthStatesContextKey, accounts);

/*
 * Provide multiple instance launch statuses
 */
provide<WrappedInstanceLauncherStatusesType>(LaunchStatesContextKey, launches);

provide(InstanceLogsContextKey, logs);
provide<LaunchContextType>(LaunchInstanceContextKey, launchInstance);
provide<(instanceId: string) => Promise<void>>(CloseInstanceContextKey, closeInstance);

GlobalInternals.logs.instanceStatuses = launches;
GlobalInternals.instanceContext = { launches, logs, launchInstance, closeInstance };

Watchers.watchLogModeStates(logs);
</script>

<template>
  <slot />
</template>
