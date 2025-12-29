import { invoke } from "@tauri-apps/api/core";

export async function getSha1Mismatches({
  paths,
}: {
  "paths": Array<{ "path": string; "hash": string }>;
}): Promise<Array<string>> {
  return invoke("verify_file_paths", {
    "artifacts": paths,
  });
}
