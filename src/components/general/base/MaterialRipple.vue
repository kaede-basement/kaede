<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { computed, inject } from "vue";

import { ApplicationNamespace, GlobalStatesContextKey } from "@/constants/application.ts";
import type { ContextGlobalStatesType } from "@/types/application/global-states.type.ts";

const { id, label, disabled, colors } = defineProps<{
  "id"      ?: string;
  "label"   ?: string;
  "disabled"?: boolean;
  "colors"  ?: {
    "ripple"  ?: string | null;
    "sparkles"?: string | null;
  };
}>();

const globalStates = inject<ContextGlobalStatesType>(GlobalStatesContextKey);

const enableRipple = computed((): boolean => {
  return globalStates?.layout?.enableMaterialYouRipple ?? false;
});

const defaultColors = {
  "ripple"  : window[ApplicationNamespace].variables.rippleColor,
  "sparkles": window[ApplicationNamespace].variables.sparklesColorRGB,
};
</script>

<template>
  <Ripple
    v-if="enableRipple"
    :id="id"
    :aria-label="label"
    :aria-hidden="true"
    :class="[disabled ? 'pointer-events-none' : '']"
    :ripple-color="colors?.ripple ?? defaultColors.ripple"
    :sparkles-color-r-g-b="colors?.sparkles ?? defaultColors.sparkles"
  />
</template>
