<script setup lang="ts">
import {
  inject, markRaw, provide, reactive, type ShallowReactive, shallowReactive, shallowRef,
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
import { accountStoreError } from "@/lib/configs/scopes/account-store.ts";
import Errors from "@/lib/errors";
import { translate } from "@/lib/general/translate.ts";
import Hooks from "@/lib/hooks";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { beginLaunchAttempt } from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { resolveLaunchPrerequisites } from "@/lib/launcher/scopes/resolve-launch-prerequisites.ts";
import { trackRunningInstances } from "@/lib/launcher/scopes/track-running-instances.ts";
import { log } from "@/lib/logging/log.ts";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const providedAccounts = inject<Array<AccountType>>(AuthOneTimeFetchContextKey) ?? [];

const accounts = shallowRef<Array<AccountType>>(providedAccounts);
const launches = reactive<Record<string, LauncherStatusesType>>({});
const logs = shallowReactive<Record<string, { "list": Array<string> }>>({});

const childProcesses: Record<string, MinecraftProcessType> = {};

function onClose(instanceId: string, statuses = launches[instanceId]): void {
  if (statuses && statuses === launches[instanceId]) {
    delete childProcesses[instanceId];
    statuses.launching = 0;
    statuses.current = LaunchStatus.General.Aborted;

    // Open instance logs since the instance was closed
    globalStates.logs.show = true;
    globalStates.logs.mode = instanceId;
  }
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

const pendingLaunches = new Set<string>;
const launchInstance: LaunchContextType = async (instanceId, options) => {
  if (!instanceId) {
    await Errors.showError(translate("general.launch-status.instance-error"));

    return;
  }

  if (pendingLaunches.has(instanceId) || launches[instanceId]?.launching) {
    return;
  }
  pendingLaunches.add(instanceId);
  try {
    await startInstance(instanceId, options);
  } finally {
    pendingLaunches.delete(instanceId);
  }
};

async function startInstance(
  instanceId: string, options: Parameters<LaunchContextType>[1],
): Promise<void> {
  if (!await ensureHydrated()) {
    await Errors.showError(translate("general.launch-status.hydration-error"));

    return;
  }
  if (launches[instanceId]?.launching) {
    return;
  }

  const currentInstance: CurrentInstanceType =
    options?.overridden ?? Instances.findCurrent(instanceId);

  if (!currentInstance || !currentInstance.instance) {
    await Errors.showError(translate("general.launch-status.instance-error"));

    return;
  }

  launches[instanceId] = {
    instanceId,
    "launching": 1,
    "current"  : undefined,
    "downloads": {
      "current": markRaw(new Map<string, [number, number]>),
      "success": 0,
      "failed" : 0,
      "total"  : 0,
    },
  };

  const statuses: LauncherStatusesType = launches[instanceId];

  const attempt = beginLaunchAttempt(statuses);

  statuses.current = LaunchStatus.General.Starting;
  const started = performance.now();

  try {
    const onInput = createLogSink(instanceId);

    if (accountStoreError.value || !accounts.value[globalStates.selected.account]) {
      const key = accountStoreError.value
        ? "profile.accounts.storage-error"
        : "general.launch-status.missing-account";

      await Errors.showError(translate(key));
      statuses.launching = 0;
      statuses.current = LaunchStatus.General.Aborted;

      return;
    }

    const prerequisites = await resolveLaunchPrerequisites(
      accounts.value, options?.javaPath, attempt.signal,
    );

    if (!prerequisites?.[1] || attempt.signal.aborted) {
      statuses.launching = 0;
      statuses.current = LaunchStatus.General.Aborted;

      return;
    }

    const [javaMajor, resolved] = prerequisites;

    accounts.value = resolved.accounts;
    const { success, process, reason } = await Launcher.handleLaunch({
      "instance"       : currentInstance.instance,
      "userPreferences": {
        "javaBinary": options?.javaPath ?? currentInstance.instance.javaBinary,
        "javaMajor" : javaMajor,
        "versions"  : currentInstance.instance.patchVersions,
        "account"   : resolved.auth,
      },
      instanceId,
      statuses,
      "onClose": id => onClose(id, statuses),
      onInput,
    }, attempt);

    if (process) {
      childProcesses[instanceId] = process;
    }
    statuses.launching = success || process ? 2 : 0;

    if (success && instanceStates[instanceId]) {
      instanceStates[instanceId] = { ...instanceStates[instanceId], "lastLaunch": Date.now() };
    }
    if (reason === "cancelled") {
      statuses.current = LaunchStatus.General.Aborted;
    } else if (!success) {
      const current = launches[instanceId].current;
      const status = current?.includes("error") ? current : LaunchStatus.Errors.UnhandledError;

      statuses.current = reason ?? status;
      const key = `general.launch-status.${statuses.current}` as const;

      await Errors.showError(translate(key));
    }
  } catch (error: unknown) {
    statuses.launching = childProcesses[instanceId] ? 2 : 0;
    statuses.current = LaunchStatus.Errors.UnhandledError;
    const label = translate("general.launch-status.errors-unhandled-error");

    await Errors.showError(`${label}: ${Errors.prettify(error)}`);

    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Unhandled error. Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  } finally {
    const elapsed = (performance.now() - started).toFixed(2);

    log.info(__PRE_BUNDLED_FILENAME__, `Launch of '${instanceId}' finished in ${elapsed} ms`);
  }
}

async function closeInstance(instanceId: string): Promise<void> {
  const process: MinecraftProcessType | undefined = childProcesses[instanceId];

  if (!process) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `The '${instanceId}' instance kill action was called but no process is present`,
    );
  }

  const beforeHooksResult: "continue" | void | undefined =
    await Hooks.catchAsyncResponseHooks<void>({
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
    if (childProcesses[instanceId] !== process) return;
    launches[instanceId].current = LaunchStatus.Errors.Stop;
    await Errors.showError(translate("general.launch-status.stop-error"));
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not kill the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }
}

const ensureHydrated = trackRunningInstances(handle => {
  const { instanceId } = handle.meta;

  childProcesses[instanceId] = handle;
  launches[instanceId] = {
    instanceId,
    "launching": 2,
    "current"  : LaunchStatus.General.Success,
    "downloads": { "current": markRaw(new Map), "success": 0, "failed": 0, "total": 0 },
  };

  return {
    "onOutput": createLogSink(instanceId),
    "onExit"  : (payload): void => {
      onClose(instanceId);
      Hooks.catchAsyncVoidHooks({
        "scope": "onMinecraftKill", "toPass": payload.pid, "timing": "after",
      });
    },
  };
});

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

GlobalInternals.instanceContext = { launches, logs, launchInstance, closeInstance };

Watchers.watchLogModeStates(logs);
</script>

<template>
  <slot />
</template>
