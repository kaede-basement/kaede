<script setup lang="ts">
import GlobalStateHelpers from "@/lib/global-state-helpers";

function handleNormalLayout(): void {
  GlobalStateHelpers.change("layout", {
    ...GlobalStateHelpers.get().layout,
    "custom": false,
  });
}
</script>

<template>
  <div
    id="__custom-layout__wrapper"
  >
    <div
      id="__custom-layout__warning-temporary"
      class="select-text p-4 text-justify text-lg"
    >
      A custom layout was enabled (perhaps by the extension?)
      If you are seeing this text, then you should probably disable the custom layout option in the config file. Or do via this button:
    </div>
    <button
      id="__custom-layout__disabler-temporary"
      class="ml-4 rounded-md bg-neutral-700 p-2 leading-none"
      @click="handleNormalLayout"
    >
      Get to normal layout
    </button>
  </div>
</template>
