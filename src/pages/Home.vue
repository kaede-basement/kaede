<script setup lang="ts">
import { Routes } from "@/constants/routes";
import { RouterLink } from "@kitbag/router";

async function download() { /* TODO */ }
async function run() { /* TODO */ }
</script>

// TODO: remove temp styles
<style lang="css">
  button {
    margin: 3px;
    background-color: lightgray;
  }
  a h1 h2 h3 h4 h5 h6 text {
    background-color: aliceblue;
  }
</style>

<template>
  <div>
    Home
  </div>
  <RouterLink :to="(resolve) => resolve(Routes.About.Key)">
    Navigate to About
  </RouterLink>
  <button @click="download">uh, download</button>
  <button @click="run">run</button>
</template>
