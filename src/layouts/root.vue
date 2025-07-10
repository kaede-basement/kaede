<template>
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator />
  <Transition name="fade">
    <div v-show="visible" class="bg-blue duration-300">
      <div>Some default layout content shared across all pages</div>
      <slot />
    </div>
  </Transition>
</template>

<script setup lang="ts">
const visible = ref(false);

// to make a transition
watchEffect(() => {
  const timeout = setTimeout(() => {
    visible.value = true;
  }, 0);

  return () => clearTimeout(timeout);
});

useHead({
  bodyAttrs: {
    class: "__nuxt-body",
  },
});
</script>

<style>
/* apply transitions for opacity */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 100ms ease;
}

/* initial state for entering, and final state for leaving */
.fade-enter-from,
.fade-leave-to {
  opacity: 0; /* start with opacity 0 (invisible) */
}

/* html document <body /> element */
.__nuxt-body {
	margin: 0;
	padding: 0;
  font-family: Geist, Roboto, sans-serif;
}
</style>
