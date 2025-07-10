import { defineStore } from "pinia";
import { getName, getVersion } from "@tauri-apps/api/app";

export const useApplicationInfo = defineStore("applicationInfo", {
  state: () => ({
    name:    null as string | null,
    version: null as string | null,
  }),
  actions: {
    async getApplicationInfo() {
      this.name = await getName();
      this.version = await getVersion();
    },
  },
});
