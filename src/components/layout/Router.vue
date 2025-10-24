<script setup lang="ts">
import type { RouteType } from "@/types/application/route.type.ts";
import { defineAsyncComponent, shallowRef, watchEffect } from "vue";
import { capitalize } from "@/lib/helpers/capitalize.ts";

const { page } = defineProps<{
  "page": RouteType;
}>();

const PageComponent = shallowRef(null);

watchEffect(() => {
  PageComponent.value = defineAsyncComponent(() => import((`@/pages/${capitalize(page)}.vue`)));
});
</script>

<template>
  <PageComponent />
</template>