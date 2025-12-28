<script setup lang="ts">
import { markRaw, provide, reactive, ref } from "vue";

import {
  ApplicationNamespace,
  AuthStatesContextKey,
  LaunchInstanceContextKey,
  LaunchStatesContextKey,
} from "@/constants/application.ts";
import { LaunchStatus } from "@/constants/launcher.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { log } from "@/lib/logging/scopes/log.ts";
import type { InstanceStatesType } from "@/types/application/instance-states.type.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";
import type {
  LauncherStatusesType,
  WrappedInstanceLauncherStatusesType,
} from "@/types/launcher/launch/launch-status.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const accounts = ref<Array<AccountType>>(
  window[ApplicationNamespace].__internals.temporaryAccounts,
);
const launches = reactive<Record<string, LauncherStatusesType>>({});

// Do not expose accounts data to globals since extensions will easily access it
window[ApplicationNamespace].__internals.temporaryAccounts = [];

async function launchInstance(instanceId?: string): Promise<void> {
  if (!instanceId) {
    log.error("The instance launch button was pressed but no instance is present");

    return;
  }

  const currentInstances: InstanceStatesType = Instances.get();
  const currentInstance: CurrentInstanceType = Instances.findCurrent(
    instanceId,
    currentInstances,
  );

  if (!currentInstance || !currentInstance.instance) {
    log.error("No current instance found");

    return;
  }

  launches[instanceId] = {
    "launching": true,
    "current"  : undefined,
    "downloads": markRaw(new Set),
  };

  const statuses: LauncherStatusesType = launches[instanceId];
  const startTime: number = performance.now();
  let success: boolean = false;

  statuses.current = LaunchStatus.General.Starting;
  statuses.downloads.clear();

  try {
    await Launcher.launchWithChecks({
      "instance": currentInstance.instance,
      instanceId,
      statuses,
    });

    success = true;
  } catch (error: unknown) {
    statuses.current = LaunchStatus.Errors.UnhandledError;

    log.error(
      `Could not launch the '${instanceId}' instance:`,
      Errors.prettify(error),
    );
  }

  const endTime: number = performance.now();
  const totalTime: string = (endTime - startTime).toFixed(2);

  log.info(
    `The '${instanceId}' launch process was done in ${totalTime} ms.`,
    `Is success: '${success}'`,
  );
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
</script>

<template>
  <slot />
</template>
