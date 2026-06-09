<script setup lang="ts">
import { Ripple } from "m3ripple-vue";
import { computed } from "vue";

import { GlobalObject } from "@/extendable/global-object.ts";
import { globalStates } from "@/states/global.ts";

const { id, label, disabled, colors } = defineProps<{
  "id"      ?: string;
  "label"   ?: string;
  "disabled"?: boolean;
  "colors"  ?: {
    "ripple"  ?: string | null;
    "sparkles"?: string | null;
  };
}>();

const enableRipple = computed((): boolean => {
  return globalStates.layout?.enableMaterialYouRipple ?? false;
});

const defaultColors = {
  "ripple"  : GlobalObject.variables.rippleColor,
  "sparkles": GlobalObject.variables.sparklesColorRGB,
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
