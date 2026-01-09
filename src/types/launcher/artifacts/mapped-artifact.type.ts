export type MappedArtifactType = {
  "id"       : string;
  "path"     : string;
  "file"     : string;
  "directory": string;
  "url"      : string;
  "hash"     : string;

  /**
   * 'library' should be both downloaded and included in the classpath
   * 'mavenFile' should be just downloaded
   * 'native' should be downloaded and extracted but not included in the classpath
   */
  "status"  ?: "library" | "mavenFile" | "native";
};
