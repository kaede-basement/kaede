<template>
  <div class="flex flex-col gap-2 items-start">
    <button @click="notify">
      send notification
    </button>
    <p>
      {{ readDirectory }}
    </p>
    <p>
      {{ shit.stdout }}
    </p>
    <p>
      exists: {{ configExists }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { appConfigDir, BaseDirectory } from "@tauri-apps/api/path";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { Command } from "@tauri-apps/plugin-shell";
import { exists, readDir, writeFile } from "@tauri-apps/plugin-fs";

function notify() {
  sendNotification({
    title: "Kaede",
    body:  "sosal?",
  });
}

const appConfigDirectoryPath = await appConfigDir();
const readDirectory = await readDir(appConfigDirectoryPath);

const configExists = await exists("config.json5", {
  baseDir: BaseDirectory.AppConfig,
});

const encoder = new TextEncoder();
const data = encoder.encode(`{
  // can be either "dark" or "light"
  theme: 'dark',
  accent: 'rose',
  language: 'ru',
  javaPath: '',
  proxy: {
    address: '127.0.0.1',
    pass: '',
    port: 8080,
    type: 'none',
    user: '',
  },
  use: {
    systemLocale: true,
  },
  minecraftWindowHeight: 480,
  minecraftWindowWidth: 854,
  showBackground: true,
}`);
await writeFile("config.json5", data, { baseDir: BaseDirectory.AppConfig });

const shit = await Command
  .create("shell-allowed-java", ["--version"])
  .execute();
</script>
