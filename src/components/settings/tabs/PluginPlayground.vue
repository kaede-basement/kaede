<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import "prism-code-editor/prism/languages/javascript";
import "prism-code-editor/layout.css";
import "prism-code-editor/themes/github-dark.css";
import "prism-code-editor/autocomplete.css";
import "prism-code-editor/autocomplete-icons.css";

import { createEditor } from "prism-code-editor";
import {
  autoComplete,
  completeFromList,
  fuzzyFilter,
  registerCompletions,
} from "prism-code-editor/autocomplete";
import {
  completeKeywords,
  jsCompletion,
  jsContext,
  jsDocCompletion,
  jsSnipets,
} from "prism-code-editor/autocomplete/javascript";
import { cursorPosition } from "prism-code-editor/cursor";
import { indentGuides } from "prism-code-editor/guides";
import { onMounted, ref } from "vue";

const codeToEvaluate = ref<string>(
  "const Command = window.__TAURI_PLUGINS_COMMUNITY__.shell.Command;",
);

onMounted(() => {
  const editor = createEditor(
    "#__settings-page__plugin-playground__editor",
    {
      "language": "javascript",
      "wordWrap": true,
      "value"   : codeToEvaluate.value,
    },
  );

  editor.addExtensions(
    cursorPosition(),
    indentGuides(),
    autoComplete({
      "filter"      : fuzzyFilter,
      "closeOnBlur" : true,
      "explicitOnly": false,
      "preferAbove" : false,
    }),
  );

  registerCompletions(["javascript", "js"], {
    "context": jsContext,
    "sources": [
      jsCompletion(window),
      completeKeywords,
      jsDocCompletion,
      completeFromList(jsSnipets),
    ],
  });
});
</script>

<template>
  <div
    id="__settings-page__plugin-playground__wrapper"
    class="h-full flex flex-col gap-2"
  >
    <div
      id="__settings-page__plugin-playground__description"
      class="text-neutral-300"
    >
      A place where you can experiment with your Kaede plugins. Any running servers will be shown on the right side.
    </div>
    <div
      id="__settings-page__plugin-playground__active-zone"
      class="h-full flex flex-wrap gap-2 px-1 text-sm sm:flex-nowrap"
    >
      <div
        id="__settings-page__plugin-playground__editor"
        class="h-full overflow-hidden rounded-md outline-2 outline-neutral-300 outline-offset-2 [&>.prism-code-editor]:h-full focus-within:outline"
      ></div>
      <div
        id="__settings-page__plugin-playground__servers"
        class="flex flex-col gap-2"
      >
        <div
          id="__settings-page__plugin-playground__server-wrapper"
          class="rounded-md bg-[#0d1117] p-1"
        ></div>
      </div>
    </div>
  </div>
</template>