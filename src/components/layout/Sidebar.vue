<template>
  <div class="border-rose-600 border-r-2 rounded-sm p-0 pr-3 m-2 ml-3">
    <div class="bg-rose-600 border-0 rounded-md p-2 pt-0 pb-0 mr--1 ">
      <p>{{ store.name }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useApplicationInfo } from "@/lib/stores/app";

const store = useApplicationInfo();
</script>
