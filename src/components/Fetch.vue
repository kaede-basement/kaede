<template>
  <div style="display: flex;">
    <button class="bg-rose" @click="fetchLatest">
      Fetch latest version
    </button>
    <a>{{ latest }}</a>
  </div>
</template>

<script setup lang="ts">
import parseVersions from "~/lib/minecraft/parseVersions";

const latest = ref();

async function fetchLatest(): void {
  const manifest = await parseVersions();

  latest.value = manifest?.latest.release;
}
</script>