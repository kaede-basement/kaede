import { defineStore } from "pinia";
import { getName, getVersion } from "@tauri-apps/api/app";
import type { ConfigType } from "~/types/Config.type";
import getConfig from "~/lib/helpers/getConfig";

// stores can be accessed in Vue from anywhere and their data persist
export const useApplicationInfo = defineStore("applicationInfo", {
  "state": () => ({
    "name"    : null as string | null,
    "version" : null as string | null,
  }),
  "actions": {
    async getApplicationInfo() {
      this.name = await getName();
      this.version = await getVersion();
    },
  },
});

export const useApplicationConfiguration = defineStore("applicationConfiguration", {
  "state": () => ({
    "data": null as ConfigType | null,
  }),
  "actions": {
    async getApplicationConfiguration() {
      this.data = await getConfig();

      return this.data;
    },
  },
});
