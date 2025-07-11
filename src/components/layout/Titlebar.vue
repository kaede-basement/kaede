<template>
  <!-- "data-tauri-drag-region" here to tell tauri that -->
  <!-- this area should be draggable -->
  <div data-tauri-drag-region class="z-10000 h-8 w-full sticky top-0 flex justify-between bg-black bg-opacity-60">
    <div class="text-white">
d
    </div>
    <div></div>
  </div>
</template>

<script setup lang="ts">
import { useApplicationInfo } from "@/lib/stores/app";

const store = useApplicationInfo();
</script>
