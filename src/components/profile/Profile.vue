<script setup lang="ts">
import { inject, useTemplateRef } from "vue";

import AccountRow from "@/components/profile/AccountRow.vue";
import Microsoft from "@/components/profile/Logins/Microsoft.vue";
import Offline from "@/components/profile/Logins/Offline.vue";
import LoginStatus from "@/components/profile/LoginStatus.vue";
import { useConfigColors } from "@/composables/use-config-colors.ts";
import { useProfileSkinRenderer } from "@/composables/use-skin-renderer.ts";
import {
  AuthStatesContextKey,
  TranslationsContextKey,
} from "@/constants/application.ts";
import { C } from "@/extendable/component-registry.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";
import type { TranslationsStateType } from "@/types/translations/translations.type.ts";

const Translations = inject<TranslationsStateType>(TranslationsContextKey);
const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

const { styles } = useConfigColors();
const viewport = useTemplateRef<HTMLElement>("viewport");
const { canvas, viewer, shown } = useProfileSkinRenderer(viewport);

function startWalk(): void {
  viewer.value?.playAnimation("walk");
  viewer.value?.startRenderLoop();
}

function stopWalk(): void {
  viewer.value?.stopRenderLoop();
  viewer.value?.stopAnimation();
  viewer.value?.render();
}
</script>

<template>
  <C.PageWrapper>
    <div
      id="__profile-page__wrapper"
      class="w-full flex flex-col gap-2 py-2 pr-2"
    >
      <div
        id="__profile-page__inner"
        class="w-full flex flex-wrap gap-2 rounded-md px-2 md:flex-nowrap md:p-0"
        :style="styles.widget"
      >
        <div
          id="__profile-page__skin-wrapper"
          class="flex flex-1 justify-center"
        >
          <div ref="viewport" id="__profile-page__skin-viewport" class="h-[225px] w-[150px] shrink-0">
            <canvas
              ref="canvas"
              id="__profile-page__skin-canvas"
              width="150"
              height="225"
              @pointerover="startWalk"
              @pointerleave="stopWalk"
              :class="[
                shown ? 'opacity-100' : 'opacity-0',
                'cursor-grab duration-300 transition-[opacity] active:cursor-grabbing',
                'w-full h-full max-w-full max-h-full',
              ]"
            />
          </div>
        </div>
        <div
          id="__profile-page__accounts-wrapper"
          class="w-full flex flex-col gap-2 py-2"
        >
          <div
            id="__profile-page__accounts-title"
            class="h-8 flex flex flex-nowrap items-center gap-2 leading-none"
          >
            <span id="__profile-page__accounts-title-label" class="pl-1">
              {{ Translations?.Messages?.["profile.accounts.title"] }}
            </span>
            <LoginStatus />
          </div>
          <div
            v-if="(accounts?.length ?? 0) === 0"
            id="__profile-page__accounts-empty"
            class="pl-1 text-sm"
            :style="styles.widgetSecondary"
          >
            {{ Translations?.Messages?.["profile.accounts.empty"] }}
          </div>
          <AccountRow
            v-for="(account, index) of accounts ?? []"
            :key="account.profile.uuid"
            :id-root="`__profile-page__account-${account.profile.uuid}`"
            :account="account"
            :index="index"
          />
        </div>
        <div
          id="__profile-page__sign-in-wrapper"
          class="min-w-44 flex flex-1 flex-col gap-2 py-2 pr-2"
        >
          <div id="__profile-page__sign-in-space" class="hidden h-8 w-full md:block"></div>
          <Microsoft />
          <Offline />
        </div>
      </div>
    </div>
  </C.PageWrapper>
</template>
