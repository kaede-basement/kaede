<!--
  - Kaede, a Minecraft Launcher
  - Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU General Public License as published by
  - the Free Software Foundation, either version 3 of the License, or
  - (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  - GNU General Public License for more details.
  -
  - You should have received a copy of the GNU General Public License
  - along with this program.  If not, see <https://www.gnu.org/licenses/>.
  -->

<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { fetch } from "@tauri-apps/plugin-http";

import ChangeInstanceGroups from "@/components/add-instance/sections/ChangeInstanceGroups.vue";
import ChangeInstanceIcon from "@/components/add-instance/sections/ChangeInstanceIcon.vue";
import ChangeInstanceName from "@/components/add-instance/sections/ChangeInstanceName.vue";
import CreateInstance from "@/components/add-instance/sections/CreateInstance.vue";
import { APIEndpoints } from "@/constants/launcher.ts";
import type { PatchIndexType } from "@/types/launcher/meta/patch-index.type.ts";

const {} = useQuery({
  "queryKey": ["meta", APIEndpoints.Meta.Paths.Minecraft.Id, "versions"],
  "queryFn" : async (): Promise<PatchIndexType["versions"]> => {
    const response: Response = await fetch(
      APIEndpoints.Meta.Base +
      APIEndpoints.Meta.Paths.Minecraft.Id,
    );
    const parsed: unknown = await response.json();

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("The provided metadata is invalid");
    }

    if (!("versions" in parsed) || !Array.isArray(parsed.versions)) {
      throw new Error("No versions in the provided metadata");
    }

    const entry: unknown = parsed.versions?.[0];

    if (typeof entry !== "object" || entry === null) {
      throw new Error("The parsed versions are invalid");
    }

    if (!("version" in entry) || !("type" in entry)) {
      throw new Error("No version or type fields in the parsed versions");
    }

    return parsed
      .versions
      .filter(({ type }) => type === "release");
  },
});
</script>

<template>
  <div id="__add-instance-page__wrapper" class="h-fit w-full flex flex-col gap-2">
    <div
      id="__add-instance-page__instance-main-group"
      class="flex flex-nowrap gap-2"
    >
      <ChangeInstanceIcon />
      <div
        id="__add-instance-page__instance-general-wrapper"
        class="w-full flex flex-col gap-2"
      >
        <ChangeInstanceName />
        <ChangeInstanceGroups />
      </div>
    </div>
    <CreateInstance />
  </div>
</template>