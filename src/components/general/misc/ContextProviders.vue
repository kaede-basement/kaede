<script setup lang="ts">
import {
  inject,
  markRaw,
  onUnmounted,
  provide,
  reactive,
  type ShallowReactive,
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
import { GlobalObject } from "@/extendable/global-object.ts";
import Auth from "@/lib/auth";
import Errors from "@/lib/errors";
import Hooks from "@/lib/hooks";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/log.ts";
import { rehydrateProcesses } from "@/lib/processes/core.ts";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import { commitPlaytime, instanceStates, startPlaytime } from "@/states/instance.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const accounts = shallowRef(inject<Array<AccountType>>(AuthOneTimeFetchContextKey) ?? []);
const launches = reactive<Record<string, LauncherStatusesType>>({});
const logs = shallowReactive<Record<string, { "list": Array<string> }>>({});

const childProcesses: Record<string, MinecraftProcessType> = {};

const pendingLaunches = new Map<string, (process: MinecraftProcessType) => void>;

function startRun(instanceId: string, process: MinecraftProcessType, rehydrated = false): void {
  childProcesses[instanceId] = process;
  startPlaytime(instanceId, process.token, rehydrated);
}

const afterLaunch = GlobalObject.hooks.onMinecraftLaunch.after;
const recordSpawn: typeof afterLaunch[number] = async ({ instanceId, process }) => {
  pendingLaunches.get(instanceId)?.(process as MinecraftProcessType);
};

afterLaunch.unshift(recordSpawn);
onUnmounted(() => {
  const index = afterLaunch.indexOf(recordSpawn);

  if (index !== -1) {
    afterLaunch.splice(index, 1);
  }
});

function onClose(instanceId: string): void {
  commitPlaytime(instanceId);
  delete childProcesses[instanceId];

  launches[instanceId].launching = 0;
  launches[instanceId].current = LaunchStatus.General.Aborted;
  globalStates.logs.show = true;
  globalStates.logs.mode = instanceId;
}

function createLogSink(instanceId: string): (lines: Array<string>) => void {
  const stored: Array<string> = [];

  // Overwrite the previous launch logs
  logs[instanceId] = { "list": stored };

  const lineLimit: number = GeneralSettings.Logs.LineLimit;

  return (lines: Array<string>): void => {
    if (logs[instanceId]?.list !== stored) {
      return;
    }

    for (const line of lines) {
      stored.push(line);
    }

    // Keeps the newest half of logs
    if (stored.length > lineLimit) {
      stored.splice(0, stored.length - Math.ceil(lineLimit / 2));
    }

    logs[instanceId] = { "list": stored };
  };
}

async function resolveLaunchAccount(): Promise<LaunchAuthType | undefined> {
  const resolved = await Auth.resolveLaunchAccount(accounts.value);

  if (resolved !== undefined) {
    accounts.value = resolved.accounts;
  }

  return resolved?.auth;
}

const getJavaMajor = (javaPath?: string): number | Promise<number> => (
  !javaPath && GlobalInternals.javaMajor
    ? GlobalInternals.javaMajor
    : Launcher.fetchJavaMajor(javaPath)
);

function launchStatus(instanceId: string, running: boolean): LauncherStatusesType {
  return {
    instanceId,
    "launching": running ? 2 : 1,
    "current"  : running ? LaunchStatus.General.Success : LaunchStatus.General.Starting,
    "downloads": {
      "current": markRaw(new Map<string, [number, number]>),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };
}

async function launchInstance(instanceId?: string, options?: Partial<{
  "javaPath"  : string;
  "overridden": CurrentInstanceType;
}>): Promise<void> {
  if (!instanceId) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No instance selected for launch");
  }

  if (!await ensureHydrated() || pendingLaunches.has(instanceId) || childProcesses[instanceId]) {
    return;
  }

  const currentInstance = options?.overridden ?? Instances.findCurrent(instanceId);

  if (!currentInstance || !currentInstance.instance) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No current instance found");
  }

  launches[instanceId] = launchStatus(instanceId, false);
  let exitedAt: number | undefined;
  const recordProcess = (process: MinecraftProcessType): void => {
    if (exitedAt === undefined) {
      startRun(instanceId, process);
    } else if (instanceStates[instanceId]) {
      instanceStates[instanceId].lastLaunch = exitedAt;
    }
  };

  pendingLaunches.set(instanceId, recordProcess);
  const statuses = launches[instanceId];

  try {
    const onInput = createLogSink(instanceId);

    const [javaMajor, account] = await Promise.all([
      getJavaMajor(options?.javaPath), resolveLaunchAccount(),
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
        if (exitedAt === undefined) {
          exitedAt = Date.now();
          onClose(instanceId);
        }
      },
      onInput,
    });

    if (exitedAt === undefined) {
      statuses.launching = success ? 2 : 0;
      if (success && process && !childProcesses[instanceId]) {
        recordProcess(process);
      }
    } else {
      statuses.current = LaunchStatus.General.Aborted;
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
}

async function closeInstance(instanceId: string): Promise<void> {
  const process = childProcesses[instanceId];

  if (!process) {
    return log.error(__PRE_BUNDLED_FILENAME__, `No running process to kill for ${instanceId}`);
  }

  const beforeHooksResult = await Hooks.catchAsyncResponseHooks<void>({
    "scope" : "onMinecraftKill",
    "toPass": process,
    "timing": "before",
  });

  if (beforeHooksResult !== "continue") {
    return;
  }

  try {
    await process.kill();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not kill the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }
}

async function rehydrateLaunchedInstances(): Promise<void> {
  await Watchers.watchProcesses();

  await rehydrateProcesses(handle => {
    if (handle.kind !== "minecraft") {
      return;
    }

    const process = handle as MinecraftProcessType;
    const { instanceId } = process.meta;

    startRun(instanceId, process, true);
    launches[instanceId] = launchStatus(instanceId, true);

    return {
      "onOutput": createLogSink(instanceId),
      "onExit"  : (payload): void => {
        if (childProcesses[instanceId]?.token !== handle.token) {
          return;
        }
        onClose(instanceId);
        Hooks.catchAsyncVoidHooks({
          "scope" : "onMinecraftKill",
          "toPass": payload.pid,
          "timing": "after",
        });
      },
    };
  });
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

provide<ShallowReactive<Record<string, { "list": Array<string> }>>>(InstanceLogsContextKey, logs);
provide<LaunchContextType>(LaunchInstanceContextKey, launchInstance);
provide<(instanceId: string) => Promise<void>>(CloseInstanceContextKey, closeInstance);

GlobalInternals.logs.instanceStatuses = launches;
GlobalInternals.instanceContext = { launches, logs, launchInstance, closeInstance };

Watchers.watchLogModeStates(logs);
</script>

<template>
  <slot />
</template>
