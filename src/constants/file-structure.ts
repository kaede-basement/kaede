export const FileStructure = {
  "Cache": {
    "Path" : "cache",
    "Files": {
      "ManifestV2": "manifest_v2.json",
    },
  },
  "Config": {
    "Name": "config.json",
  },
  "Extensions": {
    "Path": "extensions",
    "Name": "metadata.json",
  },
  "Themes": {
    "Path": "themes",
  },
  "Resources": {
    "Path": "resources",
  },
  "Instances": {
    "Path": "instances",
  },
  "InstancesData": {
    "Name": "instances.json",
  },
  "Logs": {
    "Path": "logs",
    "Name": "latest.log",
  },
} as const;