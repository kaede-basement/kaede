<script setup lang="ts">
import { Ripple } from "m3ripple-vue";

import { ApplicationNamespace } from "@/constants/application.ts";

const { disabled } = defineProps<{
  "disabled"?: boolean;
}>();

const color = window[ApplicationNamespace].variables.rippleColor;
</script>

<template>
  <Ripple
    :class="[disabled ? 'pointer-events-none' : '']"
    :ripple-color="color"
  />
</template>