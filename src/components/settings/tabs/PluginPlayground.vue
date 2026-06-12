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

import { AsyncFunction } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";
import { serverProcesses } from "@/states/servers.ts";

const codeToEvaluate = ref<string>(`// Imports, basically
const { General, ExtensionsManager } = window.__KAEDE__.libs;
const FileStructure = window.__KAEDE__.constants.FileStructure;

const answer = await confirm("Do you want to host a txiki.js server?");

if (!answer) {
  return;
}

const name = "Discord RPC";
// Unfortunately, the autocomplete only works when you directly use 'window.__KAEDE_'
const filePath = General.cachedJoin(
  General.getCachedBaseDirectory(),
  FileStructure.Folders.Extensions.Path,
  "discord-rpc.txiki",
);

ExtensionsManager.serveFile(name, filePath);
`);

async function handleCode(): Promise<void> {
  try {
    const userPlugin = new AsyncFunction(codeToEvaluate.value);

    await userPlugin();
  } catch (error: unknown) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Failed to execute the code in playground:",
      Errors.prettify(error),
    );
  }
}

onMounted(() => {
  const editor = createEditor(
    "#__settings-page__plugin-playground__editor",
    {
      "language": "javascript",
      "wordWrap": true,
      "value"   : codeToEvaluate.value,
      "onUpdate": (input: string): void => {
        codeToEvaluate.value = input;
      },
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
    class="h-full w-full flex flex-col gap-2"
  >
    <div
      id="__settings-page__plugin-playground__description"
      class="text-neutral-300"
    >
      A place where you can experiment with your Kaede plugins. Any running servers will be shown on the right side.
    </div>
    <button
      id="__settings-page__plugin-playground__execute"
      @click="handleCode"
      class="flex"
    >
      Execute the code
    </button>
    <div
      id="__settings-page__plugin-playground__active-zone"
      class="h-full w-full flex flex-wrap gap-2 px-1 text-sm sm:flex-nowrap"
    >
      <div
        id="__settings-page__plugin-playground__editor"
        class="h-full w-full overflow-hidden rounded-md outline-2 outline-neutral-300 outline-offset-2 [&>.prism-code-editor]:h-full focus-within:outline"
      ></div>
      <div
        id="__settings-page__plugin-playground__servers"
        class="w-full flex shrink-0 flex-col gap-2 sm:w-48"
      >
        <div
          id="__settings-page__plugin-playground__server-header"
          class="rounded-md bg-[#0d1117] px-2 py-1 text-neutral-300"
        >
          Here is a list of
          <span id="__settings-page__plugin-playground__server-header-count" class="text-white">
            {{ serverProcesses.length }}
          </span>
          currently running servers
        </div>
        <div
          v-for="server in serverProcesses"
          :key="server.name"
          :id="`__settings-page__plugin-playground__server-wrapper-${server.name}`"
          class="flex flex-nowrap justify-between rounded-md bg-[#0d1117] p-1"
        >
          <div
            :id="`__settings-page__plugin-playground__server-info-${server.name}`"
            class="shrink-0 select-text px-1"
          >
            {{ server.name }}
            <span
              :id="`__settings-page__plugin-playground__server-pid-${server.name}`"
              class="shrink-0 text-neutral-400"
            >
            PID: {{ server.value.pid }}
          </span>
          </div>
          <button
            :id="`__settings-page__plugin-playground__server-kill-button-${server.name}`"
            @click="() => {
              server.value.kill();
            }"
            class="flex hover:text-neutral-400"
          >
            <span
              :id="`__settings-page__plugin-playground__server-kill-icon-${server.name}`"
              class="i-lucide-x size-5 shrink-0"
            ></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>