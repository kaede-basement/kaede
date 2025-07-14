<template>
  <div class="flex flex-row gap-2 pos-relative mt-3">
    <button class="bg-rose-600 rounded-lg p-1" @click="download">Download libraries</button>
    <select v-model="selectedVersion" class="bg-rose-600 rounded-lg p-1">
      <option v-for="item in versionOptions" :key="item.id" :value="item.id">
        {{ item.id }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import parseVersions from "~/lib/network/parseVersions";
import { z } from "zod";
import downloadLibraries from "~/lib/network/downloadLibraries";

const VersionSchema = z.object({
  id             : z.string(),
  type           : z.string(),
  url            : z.string().url(),
  time           : z.string(),
  releaseTime    : z.string(),
  sha1           : z.string(),
  complianceLevel: z.number().int(),
});

const selectedVersion = ref(null);
const versionOptions = ref<z.infer<typeof VersionSchema>[]>([]);

async function fetch(): Promise<void> {
  const raw = await parseVersions();
  const parsed = z.array(VersionSchema).parse(raw?.versions);

  versionOptions.value = parsed;
}
onMounted(fetch);

async function download(): Promise<void> {
  const versionURL = versionOptions.value.find(version => version.id === selectedVersion.value)?.url;

  if (versionURL === undefined) {
    throw "Version not found!";
  }

  downloadLibraries(versionURL);
}

// async function download
</script>