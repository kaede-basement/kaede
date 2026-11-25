<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { computed, inject, ref, watch } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import {
  TranslationsContextKey,
} from "@/constants/application.ts";
import Instances from "@/lib/instances";
import { globalStates } from "@/states/global.ts";
import { ActiveRuns } from "@/states/instance.ts";
import type { CurrentInstanceType } from "@/types/launcher/meta/current-instance.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const { styles } = useConfigColors();

const Translations = inject<TranslationsStateType>(TranslationsContextKey);

const currentInstance = computed((): CurrentInstanceType => (
  Instances.findCurrent(globalStates?.selected?.currentInstance)
));
const runStart = computed(() => ActiveRuns.get(currentInstance.value?.id ?? "")?.startedAt);
const now = ref(performance.now());
const { pause, resume } = useIntervalFn(() => {
  now.value = performance.now();
}, 1000, {
  "immediate"        : false,
  "immediateCallback": true,
});

watch(runStart, startedAt => {
  if (startedAt === undefined) {
    pause();
  } else {
    resume();
  }
}, { "immediate": true });

const playTime = computed((): string => {
  const elapsed = runStart.value === undefined ? 0 : Math.max(0, now.value - runStart.value);
  const currentMillisecondsTime = (currentInstance.value?.instance?.playTime ?? 0) + elapsed;

  if (!currentMillisecondsTime) {
    return "0 seconds";
  }

  const currentTime: number = currentMillisecondsTime / 1000;
  const totalMinutes: number = currentTime / 60;
  const totalHours: number = totalMinutes / 60;

  const tenths = Math.floor((currentMillisecondsTime % 1000) / 100);
  const seconds: number = Math.floor(currentTime % 60);
  const minutes: number = Math.floor(totalMinutes % 60);
  const hours: number = Math.floor(totalHours);

  if (totalMinutes < 1) {
    return `${seconds}.${tenths} seconds`;
  }

  if (hours <= 0) {
    return `${minutes} minutes, ${seconds}.${tenths} seconds`;
  }

  const hourLabel = hours === 1 ? "hour" : "hours";

  return `${hours} ${hourLabel}, ${minutes} minutes, ${seconds}.${tenths} seconds`;
});

function handleSwitch(): void {
  globalStates.selected.stats = "last-launch";
}
</script>

<template>
  <button
    id="__home-page__current-playtime-button"
    @click="handleSwitch"
    class="relative flex flex-nowrap items-center gap-2 rounded-md p-2 transition-[background-color] hover:bg-[theme(colors.neutral.100/.05)]"
  >
    <span
      id="__home-page__current-playtime-icon-wrapper"
      class="grid size-12 shrink-0 place-items-center"
    >
      <span
        id="__home-page__current-playtime-icon"
        class="i-lucide-clock block size-8"
        :style="styles.text"
      ></span>
    </span>
    <span
      id="__home-page__current-playtime-information-wrapper"
      class="flex flex-col items-start pr-1"
    >
      <span
        id="__home-page__current-playtime-information-label"
        class="block font-medium"
        :style="styles.text"
      >
        {{ Translations?.Messages?.["home.instance.current-playtime.label"] }}
      </span>
      <span
        id="__home-page__current-playtime-information-time"
        class="relative block w-full whitespace-pre text-sm"
        :style="styles.textSecondary"
      >
        {{ " " }}
        <Transition name="fade-both-long">
          <span
            id="__home-page__current-playtime-information-time-text"
            :key="playTime"
            class="absolute left-0 w-full text-start text-nowrap"
          >
            {{ playTime }}
          </span>
        </Transition>
      </span>
    </span>
    <MaterialRipple />
  </button>
</template>
