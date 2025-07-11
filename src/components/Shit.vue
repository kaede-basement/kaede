<template>
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
import { fetch } from "@tauri-apps/plugin-http";

function timeout(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const { libraries } = defineProps<{
  libraries: Array<{
    name: string;
    downloads: {
      artifact: {
        url: string;
      };
    };
  }>;
}>();

const t1 = performance.now();

const results = useQueries({
  queries: libraries?.map((library, index) => ({
    queryKey: ["library", library.name],
    queryFn:  async () => {
      await timeout(index * 100);

      console.log("Downloading", library.name);

      const url = library.downloads.artifact.url;
      const libraryResponse = await fetch(url);
      const libraryBody = await libraryResponse.text();

      console.log("File size", libraryBody.length);

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
