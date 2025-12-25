export const FileStructure = {
  "Folders": {
    "Assets": {
      "Path": "assets",
    },
    "Libraries": {
      "Path": "libraries",
    },
    "Cache": {
      "Path" : "cache",
      "Files": {
        "ManifestV2": "manifest_v2.json",
      },
    },
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
  },
  "Files": {
    "Accounts"    : "accounts.json",
    "Translations": "translations.json",
    "Metadata"    : "instances.json",
    "Config"      : "config.json",
    "Extensions"  : "extensions.json",
  },
} as const;
