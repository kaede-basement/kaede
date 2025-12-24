export async function validateSha1({
  path,
  sha1,
}: {
  "path": string;
  "sha1": string;
}): Promise<boolean> {
  const fileSha1: string = path;

  return fileSha1 === sha1;
}
