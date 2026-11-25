<script setup lang="ts">
import { ask } from "@tauri-apps/plugin-dialog";
import { computed, type ComputedRef, inject, onUnmounted, provide, watchEffect } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import {
  CloseInstanceContextKey,
  LaunchInstanceContextKey, LaunchInstanceStatusesContextKey,
} from "@/constants/application.ts";
import Errors from "@/lib/errors";
import Instances from "@/lib/instances";
import Fetching from "@/lib/launcher/scopes/fetching";
import { log } from "@/lib/logging/log.ts";
import { globalStates } from "@/states/global.ts";
import { operation } from "@/states/instance-operation.ts";
import type { LaunchContextType } from "@/types/launcher/launch/launch-context.type.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";

const launchInstance = inject<LaunchContextType>(
  LaunchInstanceContextKey,
);
const closeInstance = inject<(instanceId: string) => Promise<void>>(
  CloseInstanceContextKey,
);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.selected?.currentInstance)
));
const selectedOperation = computed(() => operation(currentInstance.value?.id ?? ""));
const killing = computed(() => selectedOperation.value.kind === "stopping");
const launchable = computed(() => selectedOperation.value.kind === "idle");
const unstoppable = computed(() => {
  const op = selectedOperation.value;

  if (op.kind === "installing") return !op.cancel;
  if (op.kind === "launching") return op.exited || op.statuses.downloads.total === 0;

  return op.kind !== "running";
});

function handleLaunch(): void {
  if (launchInstance === undefined) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "The injected 'launchInstance' function is undefined. What happened lol",
    );

    return;
  }

  void launchInstance(currentInstance.value?.id);
}
async function handleClose(): Promise<void> {
  const instanceId = currentInstance.value?.id;

  if (!instanceId || unstoppable.value) return;
  const requested = operation(instanceId);

  if (requested.kind === "idle") return;
  const confirmed = await ask("Do you really want to cancel the Minecraft launch?", "Minecraft");

  const op = operation(instanceId);

  if (!confirmed || op.kind === "idle" || op.statuses !== requested.statuses) return;
  if (op.kind === "installing") {
    if (op === requested) await op.cancel?.();

    return;
  }
  if (op.kind === "launching") {
    if (op.exited) return;
    await Fetching.cancelAll(`${instanceId}-download`);

    return;
  }

  if (op.kind !== "running") return;
  if (closeInstance === undefined) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "The injected 'closeInstance' function is undefined. What happened lol",
    );
  }

  try {
    await closeInstance(instanceId);
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not close the instance process:",
      Errors.prettify(error),
    );
  }
}

const originalCursor = document.body.style.cursor;

watchEffect((): void => {
  const launchingInstance = selectedOperation.value.kind === "launching";
  const killingInstance: boolean = killing.value;

  document.body.style.cursor = (launchingInstance || killingInstance)
    ? "progress"
    : originalCursor;
});

onUnmounted(() => {
  document.body.style.cursor = originalCursor;
});

provide<{
  "launchable" : ComputedRef<boolean>;
  "unstoppable": ComputedRef<boolean>;
}>(LaunchInstanceStatusesContextKey, { launchable, unstoppable });
</script>

<template>
  <button
    v-if="launchable"
    @click="handleLaunch"
    id="__home-page__launch-button"
    class="relative min-w-24 rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Launch
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
    />
  </button>
  <button
    v-else
    @click="handleClose"
    id="__home-page__launch-abort-button"
    :disabled="unstoppable"
    class="relative min-w-24 rounded-l-md rounded-r-sm bg-white px-4 py-2 text-black transition-[opacity] disabled:opacity-70"
  >
    <span
      id="__home-page__launch-label"
      class="block"
    >
      Stop
    </span>
    <MaterialRipple
      :colors="{ ripple: '#00000010', sparkles: '0 0 0' }"
      :disabled="unstoppable"
    />
  </button>
  <slot />
</template>
