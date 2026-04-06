<script setup lang="ts">
import { useDebounceFn, useEventListener } from "@vueuse/core";
import { ref, useTemplateRef } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";

const {
  icon,
  placeholder,
  debounceTime,
  idRoot,
  defaultValue,
  listenToEvents,
  focusOnKeyF,
  onInput,
  onKeyDown,
  onEscape,
  onKeyboardEvent,
} = defineProps<{
  "icon"            : string;
  "placeholder"     : string;
  "debounceTime"    : number;
  "idRoot"          : string;
  "defaultValue"   ?: string;
  "listenToEvents" ?: boolean;
  "focusOnKeyF"    ?: boolean;
  "onInput"        ?: (value: string) => void;
  "onKeyDown"      ?: (event: KeyboardEvent) => void;
  "onEscape"       ?: () => void;
  "onKeyboardEvent"?: (event: KeyboardEvent) => void;
}>();

const target = useTemplateRef("target");

const focused = ref<boolean>(false);

function unFocus(): void {
  focused.value = false;
}

const handleInput = useDebounceFn((event: Event): void => {
  const target = event?.target as HTMLInputElement;
  const targetValue = target?.value ?? "";

  onInput?.(targetValue);
}, debounceTime);

function handleWrapperClick(): void {
  target.value?.focus?.();
  focused.value = true;
}

if (listenToEvents) {
  useEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (!target.value) {
        return;
      }

      event.preventDefault();
      target.value.blur?.();

      target.value.value = "";

      onEscape?.();

      return;
    }

    if (focusOnKeyF && event.ctrlKey && event.code === "KeyF") {
      event.preventDefault();
      handleWrapperClick();

      return;
    }

    onKeyboardEvent?.(event);
  });
}
</script>

<template>
  <div
    @click="handleWrapperClick"
    :id="`${idRoot}-wrapper`"
    :class="[
      focused ? 'cursor-text' : 'cursor-pointer',
      'shrink-0 relative w-28 sm:w-40 flex flex-nowrap items-center',
      'gap-2 rounded-md bg-neutral-800 pl-2',
    ]"
  >
    <div
      :id="`${idRoot}-icon`"
      :class="[
        icon,
        focused ? 'text-white' : 'text-neutral-400',
        'pointer-events-none absolute z-10 size-4 transition-[color]',
      ]"
    ></div>
    <input
      ref="target"
      :id="`${idRoot}-input`"
      :class="[
        focused ? 'text-white' : 'text-neutral-400',
        'absolute pl-8 left-0 right-0 top-0 bottom-0 bg-transparent text-sm',
        'outline-none transition-[color] focus:outline-none placeholder-neutral-400',
      ]"
      type="text"
      :placeholder="focused ? '' : placeholder"
      :value="defaultValue"
      @input="handleInput"
      @keydown="onKeyDown"
      @blur="unFocus"
    />
    <MaterialRipple :disabled="focused" />
  </div>
</template>
