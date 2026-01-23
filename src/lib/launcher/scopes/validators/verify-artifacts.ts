import General from "@/lib/general";

export function verifyArtifacts({
  paths,
  checksum,
}: {
  "paths": Array<{
    "path": string;
    "hash": string;
  }>;
  "checksum": boolean;
}): Promise<Array<string>> {
  if (checksum) {
    return General.getSha1Mismatches({ paths });
  }

  return General.getMissingPaths({
    "paths": paths.map(({ path }) => path),
  });
}
