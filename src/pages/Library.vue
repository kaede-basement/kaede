<script setup lang="ts">
import { inject } from "vue";
import { GlobalStatesChangerContextKey } from "@/constants/application.ts";
import type { GlobalStatesChangerType } from "@/types/application/global-states.type.ts";
import PageWrapper from "@/components/layout/PageWrapper.vue";

const changeGlobalState = inject<GlobalStatesChangerType>(GlobalStatesChangerContextKey);
</script>

<template>
  <PageWrapper>
    <div>
      About. Даб
    </div>
    <button @click="() => changeGlobalState?.('page', 'home')">
      Navigate to Home
    </button>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
    <div class="text-2xl">d</div>
  </PageWrapper>
</template>
