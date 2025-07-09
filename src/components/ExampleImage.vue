<template>
  <div class="flex">
    <NuxtImg
        :class="[additionalClass, 'object-cover view-transition-name-image']"
        src="https://cdn.modrinth.com/data/HVnmMxH1/images/26327bef581206670288bf7e1b1b5f411291f793.jpeg"
    />
  </div>
</template>

<script setup lang="ts">
defineProps({
  additionalClass: {
    type:     String,
    required: true,
  },
});
</script>
