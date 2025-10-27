<script setup lang="ts">
import { ApplicationNamespace } from "@/constants/application.ts";
import { Ripple } from "m3ripple-vue";

const { disabled } = defineProps<{
  "disabled"?: boolean;
}>();

const color = window[ApplicationNamespace].variables.rippleColor;
</script>

<template>
  <Ripple
    :class="[disabled ? 'pointer-events-none' : '']"
    :rippleColor="color"
  />
</template>