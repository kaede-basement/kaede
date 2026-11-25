<script setup lang="ts">
import {
  inject,
  provide,
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
import { ProcessHandlers, rehydrateProcesses, trackSpawnLifetimes } from "@/lib/processes/core.ts";
import Watchers from "@/lib/watchers";
import { globalStates } from "@/states/global.ts";
import {
  commitPlaytime, missingRunHandlers, restoredRunTokens, startPlaytime,
} from "@/states/instance.ts";
import {
  activeRun, beginLaunch, finishLaunch, Launches as launches, operation, stopRun,
} from "@/states/instance-operation.ts";
import type {
  ProcessHandlersType,
  ProcessHandleType,
} from "@/types/application/server-process.type.ts";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";
import type {
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";

const accounts = shallowRef(inject<Array<AccountType>>(AuthOneTimeFetchContextKey) ?? []);
const logs = shallowReactive<Record<string, { "list": Array<string>; "dropped": number }>>({});

function syncExitedPlaytime(): Promise<void> {
  return Instances.sync().catch(error => log.error(__PRE_BUNDLED_FILENAME__, "Exit sync:", error));
}

function onClose(instanceId: string, endedAt = performance.now()): void {
  const process = activeRun(instanceId)?.process;

  if (process) {
    commitPlaytime(instanceId, process.token, endedAt);
  }
  void syncExitedPlaytime();

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

const launchInstance: LaunchContextType = async (instanceId, options) => {
  if (!instanceId) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No instance selected for launch");
  }

  if (!await ensureHydrated()) {
    return;
  }

  const currentInstance = options?.overridden ?? Instances.findCurrent(instanceId);

  if (!currentInstance?.instance) {
    return log.error(__PRE_BUNDLED_FILENAME__, "No current instance found");
  }

  const statuses = beginLaunch(instanceId);

  if (!statuses) return;
  const lifetimes = trackSpawnLifetimes();

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
      "onSpawn": (process, startedAt) => {
        startPlaytime(instanceId, process, false, startedAt, true);
      },
      "onClose": () => {
        if (activeRun(instanceId)?.statuses === statuses) {
          onClose(instanceId);
        }
      },
      onInput,
    });

    const op = operation(instanceId);

    if (success && process && op.kind === "launching" && op.statuses === statuses) {
      const lifetime = lifetimes.get(process);
      const handlers = ProcessHandlers.get(process.token);

      if (startPlaytime(instanceId, process, false, lifetime?.startedAt, !!handlers)) {
        if (lifetime?.endedAt !== undefined) {
          onClose(instanceId, lifetime.endedAt);
        } else if (handlers) {
          const { onExit } = handlers;

          handlers.onExit = (payload): void => {
            if (activeRun(instanceId)?.statuses === statuses) onClose(instanceId);
            onExit?.(payload);
          };
        }
      }
    }
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Unhandled error. Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  } finally {
    lifetimes.close();
    finishLaunch(instanceId, statuses);
  }
};

async function closeInstance(instanceId: string): Promise<void> {
  await stopRun(instanceId, async run => {
    if (activeRun(instanceId) !== run) return;
    const result = await Hooks.catchAsyncResponseHooks<void>({
      "scope": "onMinecraftKill", "toPass": run.process, "timing": "before",
    });

    if (result !== "continue" || activeRun(instanceId) !== run) return;
    try {
      await run.process.kill();
    } catch (error) {
      const reason = error instanceof Error ? error.message : error;

      if (!run.exit || (reason !== "no managed process" &&
        reason !== `no managed process with pid ${run.process.pid}`)) throw error;
    }
    if (run.exit) await run.exit.promise;
    else if (activeRun(instanceId) === run) onClose(instanceId);
  }).catch(error => {
    log.error(__PRE_BUNDLED_FILENAME__, `Failed to kill ${instanceId}:`, Errors.prettify(error));
  });
}

async function rehydrateLaunchedInstances(): Promise<void> {
  await Watchers.watchProcesses();
  const tracked = missingRunHandlers();

  let preferred: Map<string, string> | undefined;

  function attach(handle: ProcessHandleType, endedAt?: number): ProcessHandlersType | undefined {
    if (handle.kind !== "minecraft") {
      return;
    }

    const process = handle as MinecraftProcessType;
    const { instanceId } = process.meta;

    // Missing checkpoints have been reconciled by the time the first handle is attached.
    preferred ??= restoredRunTokens();
    const token = preferred.get(instanceId);

    if (token !== undefined && token !== process.token) return;
    if (!startPlaytime(instanceId, process, true)) return;

    return {
      "onOutput": createLogSink(instanceId),
      "onExit"  : (payload): void => {
        if (activeRun(instanceId)?.process.token === handle.token) {
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
