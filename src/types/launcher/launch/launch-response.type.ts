import type { Child } from "tauri-plugin-shellx-api";

export type LaunchResponseType = {
  "success": boolean;
  "process": Child | undefined;
};
