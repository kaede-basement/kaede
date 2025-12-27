import General from "@/lib/general";

export function normalizeArtifactPath(artifact: string): {
  "directory": string;
  "file"     : string;
} {
  const paths: Array<string> = artifact.split(":");

  const group: string | undefined = paths?.[0];
  const name: string | undefined = paths?.[1];
  const version: string | undefined = paths?.[2];
  const classifier: string | undefined = paths?.[3];

  // The 'group', 'name', and 'version' elements should be always present
  if (!group || !name || !version) {
    const specifiedMessage: string =
      `(either group (${group}), name (${name}), or version (${version}) is missing)`;

    throw new Error(
      `Could not normalize artifact path ${specifiedMessage}`,
    );
  }

  const folders: Array<string> = [
    ...group.split("."),
    name,
    version,
  ];

  if (classifier !== undefined) {
    folders.push(classifier);
  }

  return {
    "directory": General.cachedJoin(...folders),
    "file"     : classifier === undefined
      ? `${name}-${version}.jar`
      : `${name}-${version}-${classifier}.jar`,
  };
}
