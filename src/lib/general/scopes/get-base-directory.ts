import { appDataDir } from "@tauri-apps/api/path";

import General from "@/lib/general";

export async function getBaseDirectory(portable?: boolean): Promise<string> {
  const safePortable = portable ?? await General.checkIsPortable();

  return safePortable
    ? await General.getExecutableDirectory()
    : await appDataDir();
}