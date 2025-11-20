import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";

export async function checkIsPortable(): Promise<boolean> {
  try {
    await exists("i_need_to_prepare_for_my_final_terms.txt", {
      "baseDir": BaseDirectory.Desktop,
    });

    /*
     * If user is using a non-portable version of the launcher,
     * then the 'exists' function should throw an error before this statement
     */
    return true;
  } catch {
    return false;
  }
}