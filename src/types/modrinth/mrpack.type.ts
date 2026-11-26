export type MrpackSummaryType = {
  "formatVersion": number;
  "name"         : string;
  "versionId"    : string;
  "summary"      : string | null;
  // '{ "minecraft": "1.20.1", "fabric-loader": "0.15.11" }'
  "dependencies" : Record<string, string>;
  "fileCount"    : number;
  "overrides"    : number;
};
