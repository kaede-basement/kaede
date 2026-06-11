<script setup lang="ts">
import { inject } from "vue";

import PageWrapper from "@/components/general/layout/PageWrapper.vue";
import { AuthStatesContextKey } from "@/constants/application.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);
</script>

<template>
  <PageWrapper>
    {{ accounts }}
  </PageWrapper>
</template>
