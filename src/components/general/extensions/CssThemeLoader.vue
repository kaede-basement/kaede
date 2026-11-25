<script setup lang="ts">
import { type DirEntry, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { onMounted, onUnmounted, ref } from "vue";

import { CSSThemeExtensions } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { translate } from "@/lib/general/translate.ts";
import { log } from "@/lib/logging/log.ts";

const failures = ref<Array<string>>([]);
let mounted = true;
const cleanup: Array<() => void> = [];

onMounted(async () => {
  try {
    const path = FileManager.join(
      FileManager.getBaseDirectory(),
      FileStructure.Folders.Themes.Path,
    );

    log.debug(__PRE_BUNDLED_FILENAME__, "Reading the 'themes' folder");

    const storedThemes = await readDir(path).catch((error: unknown): Array<DirEntry> => {
      const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
      const message = error instanceof Error ? error.message : String(error);
      const missing = /^(?:ENOENT|NotFound)\b|\bos error [23]\)?$/i;
      const missingPath = /(?:^|: )(?:the system )?cannot find the path(?: specified)?\.?$/i;

      if (code === "ENOENT" || code === "NotFound" ||
        missing.test(message) || missingPath.test(message)) {
        return [];
      }
      throw error;
    });
    const actualThemeFiles: Array<string> = [];

    for (const stored of storedThemes) {
      const possibleFile = stored.isFile || (!stored.isDirectory && !stored.isSymlink);

      if (possibleFile && stored.name.endsWith(CSSThemeExtensions.Enabled)) {
        actualThemeFiles.push(stored.name);
      }
    }

    const results = await Promise.allSettled(
      actualThemeFiles.map(name => readTextFile(FileManager.join(path, name))),
    );

    if (!mounted) {
      return;
    }

    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        failures.value.push(actualThemeFiles[index]);
        log.error(
          __PRE_BUNDLED_FILENAME__, actualThemeFiles[index], Errors.prettify(result.reason),
        );
        continue;
      }

      const stylesheet = document.createElement("style");

      stylesheet.textContent = result.value;
      document.head.append(stylesheet);
      cleanup.push(() => stylesheet.remove());
    }
  } catch (error: unknown) {
    if (mounted) {
      failures.value.push(FileStructure.Folders.Themes.Path);
    }
    log.error(__PRE_BUNDLED_FILENAME__, "Could not load all CSS themes:", Errors.prettify(error));
  }
});

onUnmounted(() => {
  mounted = false;
  for (const callback of cleanup) {
    callback();
  }
});
</script>

<template>
  <div id="__css-themes-loader__wrapper">
    <p
      v-if="failures.length > 0"
      id="__css-themes-loader-error"
      role="alert"
      class="fixed bottom-2 left-2 z-100 rounded bg-neutral-900 p-2 text-white"
    >
      {{ translate("themes.read-error") }} {{ failures.join(", ") }}
    </p>
  </div>
</template>
