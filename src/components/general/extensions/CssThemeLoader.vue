<script setup lang="ts">
import { type DirEntry, exists, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { onMounted, onUnmounted } from "vue";

import { CSSThemeExtensions } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";

let mounted = true;
const cleanup: Array<() => void> = [];

onMounted(async () => {
  try {
    const path = FileManager.join(
      FileManager.getBaseDirectory(),
      FileStructure.Folders.Themes.Path,
    );

    log.debug(__PRE_BUNDLED_FILENAME__, "Reading the 'themes' folder");
    if (!await exists(path)) {
      return;
    }

    const storedThemes: Array<DirEntry> = await readDir(path);
    const actualThemeFiles: Array<string> = [];

    for (const stored of storedThemes) {
      if (stored.isFile && stored.name.endsWith(CSSThemeExtensions.Enabled)) {
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
  <div id="__css-themes-loader__wrapper"></div>
</template>
