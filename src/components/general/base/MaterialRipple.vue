<script setup lang="ts">
import { Ripple } from "m3ripple-vue";

import { ApplicationNamespace } from "@/constants/application.ts";

const { id, label, disabled, colors } = defineProps<{
  "id"      ?: string;
  "label"   ?: string;
  "disabled"?: boolean;
  "colors"  ?: {
    "ripple"  ?: string;
    "sparkles"?: string;
  };
}>();

const defaultColors = {
  "ripple"  : window[ApplicationNamespace].variables.rippleColor,
  "sparkles": window[ApplicationNamespace].variables.sparklesColorRGB,
};
</script>

<template>
  <Ripple
    :id="id"
    :aria-label="label"
    :aria-hidden="true"
    :class="[disabled ? 'pointer-events-none' : '']"
    :ripple-color="colors?.ripple ?? defaultColors.ripple"
    :sparkles-color-r-g-b="colors?.sparkles ?? defaultColors.sparkles"
  />
</template>
