import { stat } from "@tauri-apps/plugin-fs";

import { SizeError } from "@/lib/__delete/launcher/core/errors.ts";

export async function validateFileSize(path: string, size: number): Promise<void | SizeError> {
  const file = await stat(path);

  if (file.size != size) {
    throw new SizeError(path, size, file.size);
  }
}