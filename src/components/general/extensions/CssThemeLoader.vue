<script setup lang="ts">
import { type DirEntry, readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { onMounted, onUnmounted } from "vue";

import { CSSThemeExtensions } from "@/constants/application.ts";
import FileStructure from "@/constants/file-structure.ts";
import Errors from "@/lib/errors";
import FileManager from "@/lib/file-manager";
import { log } from "@/lib/logging/log.ts";
import type { CustomThemeType } from "@/types/extensions/custom-theme.type.ts";

let mounted = true;
const cleanup: Array<() => void> = [];

async function transformToPromise(path: string, filename: string): Promise<CustomThemeType> {
  const filePath = FileManager.join(path, filename);

  log.debug(__PRE_BUNDLED_FILENAME__, `Reading the '${filename}' theme in the 'themes' folder`);
  const fileCode = await readTextFile(filePath);

  return {
    "id"     : filename.slice(0, -1 * CSSThemeExtensions.Enabled.length),
    "content": fileCode,
  };
}

onMounted(async () => {
  try {
    const path = FileManager.join(
      FileManager.getBaseDirectory(),
      FileStructure.Folders.Themes.Path,
    );

    log.debug(__PRE_BUNDLED_FILENAME__, "Reading the 'themes' folder");
    const storedThemes: Array<DirEntry> = await readDir(path);
    const themes = await Promise.all(storedThemes
      .filter(entry => entry.isFile && entry.name.endsWith(CSSThemeExtensions.Enabled))
      .map(entry => transformToPromise(path, entry.name)));

    if (!mounted) {
      return;
    }
    for (const { id, content } of themes) {
      log.debug(__PRE_BUNDLED_FILENAME__, `Applying CSS styles of the '${id}' theme`);
      const stylesheet = document.createElement("style");

      stylesheet.textContent = content;

      document.head.append(stylesheet);

      cleanup.push(() => stylesheet.remove());
    }
  } catch (error) {
    log.error(__PRE_BUNDLED_FILENAME__, "Could not load CSS themes:", Errors.prettify(error));
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
