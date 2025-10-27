<script setup lang="ts">
import { computed } from "vue";

/** Format: [date][time][target?][level] message */
const { line, index } = defineProps<{
  "line" : string;
  "index": number;
}>();

const information = computed((): {
  "date"   : string;
  "time"   : string;
  "target" : string;
  "level"  : string;
  "message": string;
} => {
  const parts = line.split("]");
  const current: {
    "date"   : string;
    "time"   : string;
    "target" : string;
    "level"  : string;
    "message": string;
  } = { "date": "", "time": "", "target": "", "level": "", "message": "" };

  if (line.startsWith("__kaede-trigger-initial")) {
    current.target = "All logs will be displayed here ᓀ‸ᓂ";

    return current;
  }

  if (line.startsWith("__kaede-trigger-loading")) {
    current.target = "Loading your logs...";

    return current;
  }

  for (const [index, part] of parts.entries()) {
    switch (index) {
      case 0: {
        current.date = part + "]";

        break;
      }
      case 1: {
        current.time = part + "]";

        break;
      }
      case 2: {
        // If true, then the target part is empty
        if (part.startsWith(" ")) {
          current.level = part.trim() + "]";

          break;
        }

        if (part.startsWith("[webview:")) {
          const targetParts = part.split("/");

          current.target = "[" + targetParts[targetParts.length - 1] + "]";

          break;
        }

        current.target = part + "]";

        break;
      }
      case 3: {
        // If true, then the target part is empty
        if (current.level !== "") {
          current.message = part;

          break;
        }

        current.level = part + "]";

        break;
      }
      default: {
        // If true, then we stumbled upon a closing bracket in the message
        if (index !== parts.length - 1) {
          current.message = current.message + part + "]";

          break;
        }

        current.message = current.message + part;

        break;
      }
    }
  }

  return current;
});

function getLevelColor(level: string): string {
  if (level.includes("DEBUG")) {
    return "text-white";
  }

  if (level.includes("INFO")) {
    return "text-blue-400";
  }

  if (level.includes("WARN")) {
    return "text-yellow-400";
  }
  if (level.includes("ERROR")) {
    return "text-red-600";
  }

  return "text-neutral-400";
}
</script>

<template>
  <div class="flex flex-nowrap gap-1 px-1 shrink-0">
    <p class="w-14 shrink-0 select-none text-center text-neutral-400">
      {{ index - 1 }}
    </p>
    <div class="break-anywhere whitespace-nowrap">
      <span :class="[getLevelColor(information.level)]">
        {{ information.level }}
      </span>
      <span class="text-neutral-400">
        {{ information.date }}
      </span>
      <span class="text-neutral-400">
        {{ information.time }}
      </span>
      <span class="text-lime-300">
        {{ information.target }}
      </span>
      <span class="text-neutral-300">
        {{ information.message }}
      </span>
    </div>
  </div>
</template>