<script setup lang="ts">
import { appDataDir, join } from "@tauri-apps/api/path";
import { message } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useDebounceFn, useEventListener } from "@vueuse/core";
import { ref, shallowRef, useTemplateRef, watchEffect } from "vue";

import MaterialRipple from "@/components/misc/MaterialRipple.vue";

const target = useTemplateRef("target");
const focused = ref<boolean>(false);
const found = shallowRef<Array<number>>([]);
const position = ref(1);
const currentInput = ref<string>("");

const {
  searchLogs,
  scrollToIndex,
  shouldVirtualize,
  toggleShouldVirtualize,
  horizontalScroll,
  toggleHorizontalScroll,
  selectAllLogs,
} = defineProps<{
  "searchLogs"            : (search: string) => Array<number>;
  "scrollToIndex"         : (index: number) => void;
  "shouldVirtualize"      : boolean;
  "toggleShouldVirtualize": () => void;
  "horizontalScroll"      : boolean;
  "toggleHorizontalScroll": () => void;
  "selectAllLogs"         : () => void;
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
  if (event.key !== "Enter" || currentInput.value === "") {
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

async function viewInExplorer(): Promise<void> {
  const latestLogAbsolutePath = await join(await appDataDir(), "logs", "latest.log");

  await revealItemInDir(latestLogAbsolutePath);
}

const handleInput = useDebounceFn((event: Event): void => {
  const target = event?.target as HTMLInputElement;
  const targetValue = target?.value ?? "";

  currentInput.value = targetValue;
  found.value = searchLogs(targetValue);
}, 200);

useEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    if (!target.value) {
      return;
    }

    event.preventDefault();
    target.value.blur?.();

    target.value.value = "";
    currentInput.value = "";
    found.value = searchLogs("");

    return;
  }

  if (event.ctrlKey && event.code === "KeyF") {
    event.preventDefault();
    focusSearch();

    return;
  }

  if (
    event.ctrlKey &&
    event.code === "KeyA" &&
    event.target === document.body
  ) {
    event.preventDefault();

    if (!shouldVirtualize) {
      selectAllLogs();

      return;
    }

    message(
      "Sorry, but you can't select text in the virtualized log viewer. " +
      "Either disable it or open the log file in a text editor.",
      {
        "title": "Kaede",
        "kind" : "warning",
      },
    );

    return;
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
  <div id="__log-controls__wrapper" class="h-8 w-full flex flex-nowrap select-none gap-2">
    <div
      id="__log-controls__search-wrapper"
      @click="focusSearch"
      :class="[
        focused ? 'cursor-text' : 'cursor-pointer',
        'shrink-0 relative w-28 sm:w-40 flex flex-nowrap items-center',
        'gap-2 rounded-md bg-neutral-800 pl-2',
      ]"
    >
      <div id="__log-controls__search-icon" :class="[
        focused ? 'text-white' : 'text-neutral-400',
        'i-lucide-search pointer-events-none absolute z-10 size-4 transition-[color]',
      ]"></div>
      <input
        id="__log-controls__search-input"
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
    <div
      id="__log-controls__matches-wrapper"
      :class="[
        currentInput === '' ? 'hidden' : 'flex',
        'h-full shrink-0 flex-nowrap items-center',
        'rounded-md bg-neutral-800 text-sm text-neutral-400',
      ]"
    >
      <button
        id="__log-controls__matches-increment-button"
        @click="incrementIndex"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span id="__log-controls__matches-increment-icon" class="i-lucide-chevron-up block size-4"></span>
        <MaterialRipple />
      </button>
      <button
        id="__log-controls__matches-decrement-button"
        @click="decrementIndex"
        class="relative grid ml-1 size-6 place-items-center rounded-md transition-[color] hover:text-white"
      >
        <span id="__log-controls__matches-decrement-icon" class="i-lucide-chevron-down block size-4"></span>
        <MaterialRipple />
      </button>
      <input
        id="__log-controls__matches-input"
        class="w-4 bg-transparent text-end outline-none sm:w-12 focus:outline-none"
        type="number"
        :min="1"
        :max="Math.max(0, found.length)"
        :value="position"
        @input="handleIndex"
      />
      <p id="__log-controls__matches-text" class="px-2">
        of {{ found.length  }} matches
      </p>
    </div>
    <button
      id="__log-controls__explorer-button"
      @click="viewInExplorer"
      class="relative grid h-full w-fit flex shrink-0 flex-nowrap place-items-center items-center gap-2 rounded-md bg-neutral-800 px-2"
      data-tooltip="View the log file in Explorer"
    >
      <span id="__log-controls__explorer-icon" :class="['i-lucide-external-link block size-4']"></span>
      <span id="__log-controls__explorer-label" class="hidden md:block">
        View in Explorer
      </span>
      <MaterialRipple />
    </button>
    <button
      id="__log-controls__horizontal-scroll-button"
      @click="toggleHorizontalScroll"
      :class="[
        horizontalScroll ? '' : 'invert',
        'z-10 shrink-0 relative grid px-2 w-fit flex flex-nowrap gap-2 bg-neutral-800',
        'items-center h-full place-items-center rounded-md transition-[filter]',
      ]"
      data-tooltip="Toggle text wrapping"
    >
      <span id="__log-controls__horizontal-scroll-icon" :class="['i-lucide-text-wrap block size-4']"></span>
      <span id="__log-controls__horizontal-scroll-label" class="hidden lg:block">
        Line Breaks
      </span>
      <MaterialRipple />
    </button>
    <button
      id="__log-controls__virtualization-button"
      @click="toggleShouldVirtualize"
      :class="[
        shouldVirtualize ? 'invert' : '',
        'z-10 shrink-0 relative grid px-2 w-fit flex flex-nowrap gap-2 bg-neutral-800',
        'items-center h-full place-items-center rounded-md transition-[filter]',
      ]"
      data-tooltip="Improve viewer performance by pre-rendering only visible lines of text"
    >
      <span id="__log-controls__virtualization-icon" :class="['i-lucide-zap block size-4']"></span>
      <span id="__log-controls__virtualization-label" class="hidden lg:block">
        Virtualize
      </span>
      <MaterialRipple />
    </button>
  </div>
</template>