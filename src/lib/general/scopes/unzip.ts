import { invoke } from "@tauri-apps/api/core";

export async function unzip({
  from,
  to,
}: {
  "from": string;
  "to"  : string;
}): Promise<boolean> {
  const result: string = await invoke("unzip_file", {
    "archiveFilePath": from,
    "targetDirPath"  : to,
  });

  return result === "Successfully extracted the provided archive";
}
