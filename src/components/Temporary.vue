<template>
  <div class="flex flex-col gap-2 items-start">
    <button class="bg-indigo" @click="notify">
      send notification
    </button>
    <button class="bg-indigo" @click="openDialog">
      open dialog
    </button>
    <div v-if="isPending" class="h-36">
      Loading...
    </div>
    <div v-else-if="isError" class="h-36">
      Error.
    </div>
    <div v-else>
      <Shit :libraries="data?.libraries" />
      <p>
        {{ data?.readDirectory }}
      </p>
      <p>
        {{ data?.libraries }}
      </p>
      <p>
        {{ data?.stdout }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { appConfigDir } from "@tauri-apps/api/path";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { message } from "@tauri-apps/plugin-dialog";
import { Command } from "@tauri-apps/plugin-shell";
import { readDir } from "@tauri-apps/plugin-fs";
import parseVersions from "~/lib/minecraft/parseVersions";
import { fetch } from "@tauri-apps/plugin-http";

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
    body:  "i love kaeeraa",
  });
}

const { data, isPending, isError } = useQuery({
  queryKey: ["temporary"],
  queryFn:  async () => {
    const appConfigDirectoryPath = await appConfigDir();
    const readDirectory = await readDir(appConfigDirectoryPath);

    const shit = await Command
      .create("shell-allowed-java", ["--version"])
      .execute();
    //const minecraft = await parseVersions();
    const response = await fetch("https://piston-meta.mojang.com/v1/packages/5d22e5893fd9c565b9a3039f1fc842aef2c4aefc/1.21.7.json");
    const body = await response.json();
    const libraries = body.libraries;

    /*
    const t1 = performance.now();

    for (const library of libraries) {
      console.log("Downloading", library.name);

      const url = library.downloads.artifact.url;
      const libraryResponse = await fetch(url);
      const libraryBody = await libraryResponse.text();

      console.log("File size", libraryBody.length);
    }

    const t2 = performance.now();
    console.log("Done in", t2 - t1, "ms");
     */

    return {
      readDirectory,
      libraries,
      stdout: shit.stdout,
    };
  },
});
</script>
