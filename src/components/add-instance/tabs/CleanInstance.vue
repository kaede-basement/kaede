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
import ChangeInstanceGroups from "@/components/add-instance/sections/ChangeInstanceGroups.vue";
import ChangeInstanceIcon from "@/components/add-instance/sections/ChangeInstanceIcon.vue";
import ChangeInstanceName from "@/components/add-instance/sections/ChangeInstanceName.vue";
import ChangeInstanceResolution
  from "@/components/add-instance/sections/ChangeInstanceResolution.vue";
import ChangeInstanceVersion from "@/components/add-instance/sections/ChangeInstanceVersion.vue";
import CreateInstance from "@/components/add-instance/sections/CreateInstance.vue";
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
    <ChangeInstanceVersion />
    <div
      id="__add-instance-page__instance-others-group"
      class="flex flex-wrap gap-2 sm:flex-nowrap"
    >
      <ChangeInstanceResolution />
    </div>
    <CreateInstance />
  </div>
</template>