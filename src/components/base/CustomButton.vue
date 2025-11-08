<script setup lang="ts">
import MaterialRipple from "@/components/misc/MaterialRipple.vue";
import type { LogButtonType } from "@/types/ui/log-button.type.ts";

const {
  icon,
  label,
  tooltip,
  onClick,
  invert,
  hideOnSm,
  ids,
  hidden,
} = defineProps<LogButtonType>();
</script>

<template>
  <button
    :id="ids.wrapper"
    @click="onClick"
    :class="[
      hidden ? 'hidden' : 'flex',
      invert ? 'invert' : '',
      'z-10 shrink-0 relative grid px-2 w-fit flex-nowrap gap-2 bg-neutral-800',
      'items-center h-full place-items-center rounded-md transition-[filter]',
    ]"
    :data-tooltip="tooltip"
  >
    <span :id="ids.icon" :class="[icon, 'block size-4']"></span>
    <span
      v-if="ids?.label && label"
      :id="ids?.label"
      :class="[hideOnSm ? 'hidden sm:block' : 'block']"
    >
      {{ label }}
    </span>
    <MaterialRipple />
  </button>
</template>