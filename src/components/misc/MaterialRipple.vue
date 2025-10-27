<script setup lang="ts">
import { ApplicationNamespace } from "@/constants/application.ts";
import { Ripple } from "m3ripple-vue";

const color = window[ApplicationNamespace].variables.rippleColor;
</script>

<template>
  <Ripple :rippleColor="color" />
</template>