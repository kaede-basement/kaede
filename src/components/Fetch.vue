<template>
  <div style="display: flex; flex-direction: column; gap: 5px; width: 35%">
    <div class="bg-rose" style="padding: 5px; border-radius: 5px; display: flex; gap: 16px;">
      <button @click="fetchLatest">
        Fetch latest version
      </button>
      <a style="color: #DDD;">{{ latestReference }}</a>
    </div>
    <div class="bg-rose" style="padding: 5px; border-radius: 5px; display: flex;">
      <button @click="fetchVersion">
        Fetch {{ version }} manifest
      </button>
      <input
      v-model="version"
      type="text"
      class="bg-rose-500"
      style="height: 50%; width: 50%; border-radius: 5px;">
    </div>
  </div>
  <div v-if="isPending" class="h-36">
      Loading...
    </div>
    <div v-else>
      <pre>{{ manifestReference }}</pre>
    </div>
</template>

<script setup lang="ts">
import parseVersions from "~/lib/minecraft/parseVersions";

interface VersionType {
  id             : string;
  type           : string;
  url            : string;
  time           : string;
  releaseTime    : string;
  sha1           : string;
  complianceLevel: number;
}

const latestReference = ref();
const manifestReference = ref();
const version = ref("1.16.5");

const { isPending, data } = useQuery({
  queryKey: ["manifest", version],
  queryFn : findVersion,
});

async function findVersion() {
  const manifest = await parseVersions();

  const entry = manifest?.versions?.find((entry: VersionType) => {
    return entry.id === version.value;
  });

  return entry;
}

async function fetchLatest(): Promise<void> {
  const manifest = await parseVersions();

  latestReference.value = manifest?.latest.release;
}

async function fetchVersion(): Promise<void> {
  if (!data.value) {
    return;
  }

  const output = JSON.stringify(data.value, null, 2);

  manifestReference.value = output;
}
</script>