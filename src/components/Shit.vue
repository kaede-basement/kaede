<template>
  <div>
    {{ progressData }}
  </div>
  <p>
    Time elapsed in seconds: {{ timeElapsed / 1000 }} (updates only when queries resolve)
  </p>
  <div>
    Pending: {{ shit.filter((element) => element === "pending").length }} requests
  </div>
  <div>
    {{ shit }}
  </div>
  <div class="w-full h-1 bg-amber" />
</template>

<script setup lang="ts">
// import { fetch } from "@tauri-apps/plugin-http";
// import { exists, writeFile } from "@tauri-apps/plugin-fs";
// import { FunctionResponses } from "~/constants/app";
import { appConfigDir, BaseDirectory, join } from "@tauri-apps/api/path";
// import makeDirectories from "~/lib/storage/makeDirectories";
import { download } from "@tauri-apps/plugin-upload";

function timeout(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const { libraries } = defineProps<{
  libraries: Array<{
    name: string;
    downloads: {
      artifact: {
        url:  string;
        path: string;
      };
    };
  }>;
}>();

const progressData: Record<number, string> = reactive({});

const t1 = performance.now();

const results = useQueries({
  queries: libraries?.map((library, index) => ({
    queryKey: ["library", library.name],
    queryFn:  async () => {
      const chunkIndex = Math.floor(index / 6);

      await timeout(chunkIndex * 0);

      console.log("Downloading", library.name);

      const url = library.downloads.artifact.url;

      // const libraryResponse = await fetch(url);
      // const libraryBody = await libraryResponse.text();

      // console.log("File size", libraryBody.length);

      const paths = library.downloads.artifact.path.split("/");
      const filename = paths.pop() ?? "";
      const fullRelativePathToFile = await join("libraries", ...paths, filename);
      const fullAbsolutePathToFile = await join(await appConfigDir(), fullRelativePathToFile);

      /*
      if (
        await exists(fullRelativePathToFile, {
          baseDir: BaseDirectory.AppConfig,
        })
      ) {
        return "exists";
      }
       */

      /*
      await makeDirectories({
        directories: [
          {
            baseDirectoryPath:    BaseDirectory.AppConfig,
            recursiveDirectories: ["libraries", ...paths],
          },
        ],
      });

      const encoder: TextEncoder = new TextEncoder();
      const data: Uint8Array = encoder.encode(libraryBody);

      // we are wrapping this in "try & catch" construction
      // because "writeFile" can throw an error
      try {
        await writeFile(
          fullRelativePathToFile, data,
          { baseDir: BaseDirectory.AppConfig },
        );
      } catch (error: unknown) {
        console.error(error);

        return FunctionResponses.Error;
      }
       */

      try {
        await download(
          url,
          fullAbsolutePathToFile,
          ({ progressTotal, total }) => {
            progressData[index] = `Downloaded ${Math.floor((progressTotal / total) * 100)}%`;
          },
        );
      } catch (error: unknown) {
        console.error(error);
      }

      return "success";
    },
    staleTime: Infinity,
  })),
});

const shit = computed(() => results.value.map((result) => result.status));
const timeElapsed = ref(0);

watchEffect(() => {
  timeElapsed.value = performance.now() - t1;

  const set = new Set(shit.value);

  if (set.has("success") && set.size === 1) {
    const t2 = performance.now();

    console.log("Done in", t2 - t1, "ms");
  }
});
</script>
