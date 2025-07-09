<template>
  <NuxtLayout name="root">
    {{ readDirectory }}
    {{ shit.stdout }}
  </NuxtLayout>
</template>

<script setup lang="ts">
import { appConfigDir, BaseDirectory } from "@tauri-apps/api/path";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { Command } from "@tauri-apps/plugin-shell";
import { readDir, writeFile } from "@tauri-apps/plugin-fs";
import JSON5 from "json5";

const appConfigDirectoryPath = await appConfigDir();
const readDirectory = await readDir(appConfigDirectoryPath);

const encoder = new TextEncoder();
const data = encoder.encode(JSON5.stringify({
    theme:    "dark",
    accent:   "rose",
    language: "ru",
    javaPath: "",
    proxy:    {
        address: "127.0.0.1",
        pass:    "",
        port:    8080,
        type:    "none",
        user:    "",
    },
    use: {
        systemLocale: true,
    },
    minecraftWindowHeight: 480,
    minecraftWindowWidth:  854,
    showBackground:        true,
}, null, 2));
await writeFile("config.json5", data, { baseDir: BaseDirectory.AppConfig });

const shit = await Command
    .create("shell-allowed-java", ["--version"])
    .execute();

sendNotification({
    title: "Kaede",
    body:  "sosal?",
});
</script>
