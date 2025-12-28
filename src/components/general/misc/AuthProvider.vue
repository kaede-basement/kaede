<script setup lang="ts">
import { provide, ref } from "vue";

import { ApplicationNamespace, AuthStatesContextKey } from "@/constants/application.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";

const accounts = ref<Array<AccountType>>(
  window[ApplicationNamespace].__internals.temporaryAccounts,
);

// Do not expose accounts data to globals since extensions will easily access it
window[ApplicationNamespace].__internals.temporaryAccounts = [];

/*
 * AFAIK, even unrestricted extensions should not be able to access this context
 * although they can still just read the 'accounts.json' file
 * or do whatever they want in the system.
 */
provide<WrappedAccountsType>(AuthStatesContextKey, accounts);
</script>

<template>
  <slot />
</template>
