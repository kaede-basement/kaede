import { BaseDirectory } from "@tauri-apps/plugin-fs";

export const FileStructure = {
  "Base"  : BaseDirectory.AppData,
  "Config": {
    "Name": "config.json",
  },
  "Resources": {
    "Path": "resources",
  },
  "Instances": {
    "Path": "instances",
  },
  "Logs": {
    "Path": "logs",
    "Name": "latest.log",
  },
} as const;