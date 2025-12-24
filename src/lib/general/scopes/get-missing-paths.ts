import { invoke } from "@tauri-apps/api/core";

export async function getMissingPaths({
  paths,
}: {
  "paths": Array<string>;
}): Promise<Array<string>> {
  return invoke("get_missing_files", {
    paths,
  });
}
