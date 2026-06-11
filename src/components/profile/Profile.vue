<script setup lang="ts">
import { fetch } from "@tauri-apps/plugin-http";
import { HitAnimation, IdleAnimation, Render } from "skin3d";
import { inject, onMounted, ref, useTemplateRef } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { AuthStatesContextKey } from "@/constants/application.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

const canvas = useTemplateRef("canvas");
const canvasTwo = useTemplateRef("canvas2");

const status = ref<string>("loading");

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

onMounted(async () => {
  const [skinResponse, capeResponse, skinTwoResponse] = await Promise.all([
    fetch("https://s.namemc.com/i/899689bd861f19e6.png"),
    fetch("https://optifine.net/capes/windstone_.png"),
    fetch("https://s.namemc.com/i/e8b73a9b9b857a22.png"),
  ]);
  const [skinBlob, capeBlob, skinTwoBlob] = await Promise.all([
    skinResponse.blob(),
    capeResponse.blob(),
    skinTwoResponse.blob(),
  ]);
  const skin: string = URL.createObjectURL(skinBlob);
  const cape: string = URL.createObjectURL(capeBlob);
  const skinTwo: string = URL.createObjectURL(skinTwoBlob);

  const viewer = new Render({
    "canvas"   : canvas.value ?? undefined,
    "width"    : 300,
    "height"   : 400,
    "animation": new IdleAnimation,
  });

  new Render({
    "canvas"   : canvasTwo.value ?? undefined,
    "width"    : 300,
    "height"   : 400,
    "skin"     : skinTwo,
    "animation": new HitAnimation,
  });

  await viewer.loadSkin(skin);
  await viewer.loadCape(cape);

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
      <canvas ref="canvas2" width="300" height="400" />
    </div>
  </PageWrapper>
</template>
