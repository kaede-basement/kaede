import { invoke } from "@tauri-apps/api/core";

export async function getExecutableDirectory(): Promise<string> {
  return await invoke("get_executable_directory");
}