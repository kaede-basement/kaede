<script setup lang="ts">
import { join } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { getExecutableDirectory } from "@/lib/general/scopes/get-executable-directory.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import { log } from "@/lib/logging/scopes/log.ts";

async function download(): Promise<void> {}
async function run(): Promise<void> {}

(async (): Promise<void> => {
  log.info("\n" + JSON.stringify(
    await readDir(
      await join(
        await getExecutableDirectory(),
      ),
    ),
    null,
    2,
  ));
})();
</script>

<template>
  <PageWrapper>
    <div id="__home-page__wrapper" class="flex flex-col justify-start gap-2 opacity-50">
      <div id="__home-page__title w-fit">
        Home
      </div>
      <button id="__home-page__navigate-button" class="w-fit" @click="() => GlobalStateHelpers.Pages.navigate('library')">
        Navigate to Library
      </button>
      <button id="__home-page__download-button" class="w-fit" @click="download">uh, download</button>
      <button id="__home-page__run-button" class="w-fit" @click="run">run</button>
      <div
        v-for="(_, index) in Array.from({ length: 50 })"
        :key="index"
        :id="`__home-page__element-${index}`"
        class="text-2xl"
      >d{{ index }}</div>
    </div>
  </PageWrapper>
</template>
