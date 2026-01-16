export default {
  "Folders": {
    "Assets": {
      "Path"   : "assets",
      "Folders": {
        "Indexes": {
          "Path": "indexes",
        },
        "Objects": {
          "Path": "objects",
        },
        "LogConfigs": {
          "Path": "log_configs",
        },
      },
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
    "Translations": {
      "Path": "translations",
    },
    "Extensions": {
      "Path": "extensions",
    },
    "Instances": {
      "Path"   : "instances",
      "Folders": {
        "_Entry_": {
          "Folders": {
            "Minecraft": {
              "Path": "minecraft",
            },
            "Natives": {
              "Path": "natives",
            },
          },
        },
      },
    },
    "Logs": {
      "Path" : "logs",
      "Files": {
        "LatestLog": "latest.log",
      },
    },
  },
  "Files": {
    "Accounts"  : "accounts.json",
    "Metadata"  : "instances.json",
    "Config"    : "config.json",
    "Extensions": "extensions.json",
  },
} as const;
