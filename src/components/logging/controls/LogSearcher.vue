<script setup lang="ts">
import { message } from "@tauri-apps/plugin-dialog";

import CustomInput from "@/components/base/CustomInput.vue";
import MaterialRipple from "@/components/misc/MaterialRipple.vue";

const {
  searching,
  position,
  found,
  shouldVirtualize,
  selectAllLogs,
  searchLogs,
  setPosition,
  setFound,
} = defineProps<{
  "searching"       : string;
  "position"        : number;
  "found"           : Array<number>;
  "shouldVirtualize": boolean;
  "selectAllLogs"   : () => void;
  "searchLogs"      : (newSearch: string) => Array<number>;
  "setPosition"     : (newPosition: number) => void;
  "setFound"        : (newFound: Array<number>) => void;
}>();

function incrementIndex(): void {
  setPosition(Math.min(found.length, position + 1));
}
function decrementIndex(): void {
  setPosition(Math.max(0, position - 1));
}
function handleIndex(event: Event): void {
  const target = event?.target as HTMLInputElement;

  if (target?.value === undefined) {
    return;
  }

  const newValue = Number(target.value);

  setPosition(Math.min(
    Math.max(0, found.length),
    Math.max(
      0,
      newValue,
    ),
  ));
}

function handleInput(inputValue: string): void {
  setFound(searchLogs(inputValue));
}
function handleEscape(): void {
  setFound(searchLogs(""));
}
function handleEnter(event: KeyboardEvent): void {
  if (event.key !== "Enter" || searching === "") {
    return;
  }

  if (event.shiftKey) {
    setPosition(Math.max(0, position - 1));

    return;
  }

  setPosition(Math.min(
    Math.max(0, found.length),
    position + 1,
  ));
}
function handleTextSelection(event: KeyboardEvent): void {
  if (
    !event.ctrlKey ||
    event.code !== "KeyA" ||
    event.target !== document.body
  ) {
    return;
  }

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
}
</script>

<template>
  <custom-input
    icon="i-lucide-search"
    placeholder="Search..."
    :debounce-time="200"
    :listen-to-events="true"
    :focus-on-key-f="true"
    :ids="{
      'wrapper': '__log-controls__search-wrapper',
      'icon'   : '__log-controls__search-icon',
      'input'  : '__log-controls__search-input',
    }"
    :on-input="handleInput"
    :on-key-down="handleEnter"
    :on-escape="handleEscape"
    :on-keyboard-event="handleTextSelection"
  />
  <div
    id="__log-controls__matches-wrapper"
    :class="[
      searching === '' ? 'hidden' : 'flex',
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
      of {{ found.length }} matches
    </p>
  </div>
</template>