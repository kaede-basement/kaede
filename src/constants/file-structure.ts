export const FileStructure = {
  "Folders": {
    "Resources": {
      "Path": "resources",
    },
    "Themes": {
      "Path": "themes",
    },
    "Extensions": {
      "Path": "extensions",
    },
    "Instances": {
      "Path": "instances",
    },
    "Logs": {
      "Path" : "logs",
      "Files": {
        "LatestLog": "latest.log",
      },
    },
    "Cache": {
      "Path" : "cache",
      "Files": {
        "ManifestV2": "manifest_v2.json",
      },
    },
  },
  "Files": {
    "Metadata"  : "instances.json",
    "Config"    : "config.json",
    "Extensions": "extensions.json",
  },
} as const;