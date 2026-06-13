<script setup lang="ts">
import { createSkinViewer, use } from "@daidr/minecraft-skin-renderer";
import { WebGLRendererPlugin } from "@daidr/minecraft-skin-renderer/webgl";
import { fetch } from "@tauri-apps/plugin-http";
import { inject, onMounted, ref, useTemplateRef } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { AuthStatesContextKey } from "@/constants/application.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

const canvas = useTemplateRef("canvas");

const status = ref<string>("loading");

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

onMounted(async () => {
  const [skinResponse, capeResponse] = await Promise.all([
    fetch("https://s.namemc.com/i/e8b73a9b9b857a22.png"),
    fetch("https://optifine.net/capes/windstone_.png"),
  ]);
  const [skinBlob, capeBlob] = await Promise.all([
    skinResponse.blob(),
    capeResponse.blob(),
  ]);
  const skin: string = URL.createObjectURL(skinBlob);
  const cape: string = URL.createObjectURL(capeBlob);

  if (!canvas.value) {
    return;
  }

  // Register renderer plugin (required before creating viewer)
  use(WebGLRendererPlugin);

  // Create viewer
  const viewer = await createSkinViewer({
    "canvas": canvas.value,
    "skin"  : skin,
    "cape"  : cape,
    "slim"  : true,
  });

  viewer.startRenderLoop();

  status.value = "done";
});
</script>

<template>
  <PageWrapper>
    {{ accounts }}
    <div>
      {{ status }}
    </div>
    <div class="flex">
      <canvas ref="canvas" width="300" height="400" />
    </div>
  </PageWrapper>
</template>
