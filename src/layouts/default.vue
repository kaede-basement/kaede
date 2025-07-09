<template>
  <NuxtRouteAnnouncer />
	<div>
		<div>Some default layout content shared across all pages</div>
		<slot />
	</div>
</template>

<script setup lang="ts">
useHead({
    bodyAttrs: {
        class: "__nuxt-body",
    },
});
</script>

<style>
.__nuxt-body {
	margin: 0;
	padding: 0;
}
</style>
