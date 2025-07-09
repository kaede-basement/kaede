<template>
  <div class="flex flex-col gap-2 items-start">
    <button class="bg-indigo" @click="notify">
      send notification
    </button>
    <button class="bg-indigo" @click="openDialog">
      open dialog
    </button>
    <div v-if="isPending" class="h-30">
      Loading...
    </div>
    <div v-else-if="error" class="h-30">
      Error.
    </div>
    <div v-else>
      <p>
        {{ data?.readDirectory }}
      </p>
      <p>
        {{ data?.stdout }}
      </p>
      <p>
        exists: {{ data?.configExists }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { appConfigDir, BaseDirectory } from "@tauri-apps/api/path";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { message } from "@tauri-apps/plugin-dialog";
import { Command } from "@tauri-apps/plugin-shell";
import { exists, readDir, writeFile } from "@tauri-apps/plugin-fs";

async function openDialog() {
  await message("This is some peak shit here",
    {
      title: "абсолют синема",
      kind:  "info",
    });
}

function notify() {
  sendNotification({
    title: "Kaede",
    body:  "sosal?",
  });
}

const { data, isPending, error } = useQuery({
  queryKey: ["temporary"],
  queryFn:  async () => {
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

    return {
      readDirectory,
      configExists,
      stdout: shit.stdout,
    };
  },
});
</script>
