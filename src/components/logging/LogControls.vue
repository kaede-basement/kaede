<script setup lang="ts">
import MaterialRipple from "@/components/misc/MaterialRipple.vue";
import { ref, shallowRef, useTemplateRef, watchEffect } from "vue";
import { useDebounceFn, useEventListener } from "@vueuse/core";

const target = useTemplateRef("target");
const focused = ref<boolean>(false);
const found = shallowRef<Array<number>>([]);
const position = ref(1);

const { searchLogs, scrollToIndex } = defineProps<{
  "searchLogs"   : (search: string) => Array<number>;
  "scrollToIndex": (index: number) => void;
}>();

function focusSearch(): void {
  target.value?.focus?.();
  focused.value = true;
}
function incrementIndex(): void {
  position.value = Math.min(found.value.length, position.value + 1);
}
function decrementIndex(): void {
  position.value = Math.max(0, position.value - 1);
}
function handleIndex(event: Event): void {
  const target = event?.target as HTMLInputElement;

  if (target?.value === undefined) {
    return;
  }

  const newValue = Number(target.value);

  position.value = Math.min(
    Math.max(0, found.value.length),
    Math.max(
      0,
      newValue,
    ),
  );
}
function handleEnter(event: KeyboardEvent): void {
  if (event.key !== "Enter") {
    return;
  }

  if (event.shiftKey) {
    position.value = Math.max(0, position.value - 1);

    return;
  }

  position.value = Math.min(
    Math.max(0, found.value.length),
    position.value + 1,
  );
}

const handleInput = useDebounceFn((event: Event): void => {
  const target = event?.target as HTMLInputElement;

  found.value = searchLogs(target?.value ?? "");
}, 200);

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    event.preventDefault();
    target.value?.blur?.();
  }

  if (event.ctrlKey && event.code === "KeyF") {
    event.preventDefault();
    focusSearch();
  }
});

watchEffect(() => {
  if (found.value[position.value - 1] === undefined) {
    return;
  }

  scrollToIndex(found.value[position.value - 1]);
});
</script>

<template>
  <div class="h-8 w-full flex flex-nowrap gap-2">
    <div
      @click="focusSearch"
      :class="[
        focused ? 'cursor-text' : 'cursor-pointer',
        'relative w-40 flex flex-nowrap items-center gap-2 rounded-md bg-neutral-800 pl-2',
      ]"
    >
      <div :class="[
        focused ? 'text-white' : 'text-neutral-400',
        'i-lucide-search pointer-events-none absolute z-10 size-4 transition-[color]',
      ]"></div>
      <input
        ref="target"
        :class="[
          focused ? 'text-white' : 'text-neutral-400',
          'absolute pl-8 left-0 right-0 top-0 bottom-0 bg-transparent text-sm',
          'outline-none transition-[color] focus:outline-none placeholder-neutral-400',
        ]"
        type="text"
        :placeholder="focused ? '' : 'Search...'"
        @input="handleInput"
        @keydown="handleEnter"
        @blur="() => focused = false"
      />
      <MaterialRipple :disabled="focused" />
    </div>
    <div class="flex flex-nowrap bg-neutral-800 items-center h-full rounded-md text-sm text-neutral-400">
      <button
        @click="incrementIndex"
        class="relative grid size-6 ml-1 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span class="block i-lucide-chevron-up size-4"></span>
        <MaterialRipple />
      </button>
      <button
        @click="decrementIndex"
        class="relative grid size-6 ml-1 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span class="block i-lucide-chevron-down size-4"></span>
        <MaterialRipple />
      </button>
      <input
        class="w-12 bg-transparent text-end outline-none focus:outline-none"
        type="number"
        min="0"
        :max="Math.max(0, found.length)"
        :value="position"
        @input="handleIndex"
      />
      <p class="px-2">
        of {{ found.length  }} matches
      </p>
    </div>
    <button class="relative grid px-2 w-fit flex flex-nowrap gap-2 items-center h-full place-items-center rounded-md bg-neutral-800">
      <span :class="['i-lucide-external-link block size-4']"></span>
      <span class="block">
        View in Explorer
      </span>
      <MaterialRipple />
    </button>
  </div>
</template>