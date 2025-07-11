<template>
  <!-- "data-tauri-drag-region" here to tell tauri that -->
  <!-- this area should be draggable -->
  <div data-tauri-drag-region class="z-10000 h-8 w-full sticky top-0 flex flex-nowrap items-center justify-between gap-2 bg-black bg-opacity-85">
    <div data-tauri-drag-region class="flex flex-nowrap gap-0 w-24 h-full">
      <!-- "v-for" means we iterate through an array of items -->
      <!-- and use that item as properties for some elements -->
      <!-- ":key" here is to make Vue differentiate elements -->
      <!-- "@click" uses function from an array item and fires it on click -->
      <button
          v-for="item in redirectButtons"
          :key="item.icon"
          @click="item.action"
          class="group flex justify-center items-center w-8"
      >
        <span class="flex justify-center items-center rounded-full text-white w-6 h-6 bg-[#242428] group-hover:bg-[#303039] transition">
          <!-- we use ":name" and not "name" to tell Vue -->
          <!-- that passed value to the property will not be -->
          <!-- just a string; it will be a variable -->
          <Icon :name="item.icon" :size="item.size" />
        </span>
      </button>
    </div>
    <div data-tauri-drag-region class="select-none flex flex-nowrap justify-start gap-2 items-center w-fit">
      <div data-tauri-drag-region class="font-semibold text-nowrap text-sm text-white flex items-center gap-1.5">
        <span data-tauri-drag-region class="animate-gradient select-none text-transparent bg-clip-text bg-[linear-gradient(to_right,#eb6f92,#f71e5b,#eb6f92)] bg-[length:200%_auto] leading-none">
          <!-- "??" is a nullish coalescing -->
          <!-- here it assigns an empty string if "store.name" is null or undefined -->
          {{ capitalizeWord(store.name ?? "") }}
        </span>
        <span data-tauri-drag-region class="select-none text-xs text-zinc-500 leading-none">
          {{ store.version }}
        </span>
      </div>
    </div>
    <div class="flex h-full gap-0 items-stretch">
      <button
          v-for="item in windowButtons"
          :key="item.icon"
          @click="item.action"
          class="group flex justify-center items-center w-8"
      >
        <span :class="[item.classes, 'flex justify-center items-center rounded-full text-transparent w-4 h-4 transition']">
          <Icon :name="item.icon" :size="item.size" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useApplicationInfo } from "@/lib/stores/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import capitalizeWord from "~/lib/misc/capitalizeWord";

const store = useApplicationInfo();
const currentWindow = getCurrentWindow();
const isWindowMaximized = ref(false);

// go back in page navigations
function redirectBack() {
  globalThis.history.back();
}
// go forward in page navigations
function redirectForward() {
  globalThis.history.forward();
}

// minimise app window
async function minimise() {
  await currentWindow.minimize();
}
// maximise app window
async function maximise() {
  await currentWindow.toggleMaximize();

  // assign current window state to the "isWindowMaximized" ref
  isWindowMaximized.value = await currentWindow.isMaximized();
}
// close app
async function close() {
  await currentWindow.destroy();
}

const redirectButtons = [
  {
    icon:   "lucide:arrow-left",
    size:   16,
    action: redirectBack,
  },
  {
    icon:   "lucide:arrow-right",
    size:   16,
    action: redirectForward,
  },
];
const windowButtons = computed(() => [
  {
    icon:    "lucide:minus",
    size:    12,
    action:  minimise,
    classes: "group-hover:text-[#733e01] bg-[#ebbcba]",
  },
  {
    icon: isWindowMaximized.value
      ? "lucide:chevrons-right-left"
      : "lucide:chevrons-left-right",
    size:    14,
    action:  maximise,
    classes: "group-hover:text-[#01540d] bg-[#9ccfd8]",
  },
  {
    icon:    "lucide:x",
    size:    12,
    action:  close,
    classes: "group-hover:text-[#700700] bg-[#eb6f92]",
  },
]);
</script>
