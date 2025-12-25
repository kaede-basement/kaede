import General from "@/lib/general";

export function normalizeArtifactPath(name: string): {
  "directory": string;
  "file"     : string;
} {
  const paths: Array<string> = name.split(":");
  const normalizedPaths: Array<string> = paths[0].split(".");

  paths.shift();
  paths.unshift(...normalizedPaths);

  const fileName: string = paths.pop() ?? "";

  return {
    "directory": General.cachedJoin(
      ...paths,
    ),
    "file": fileName,
  };
}
