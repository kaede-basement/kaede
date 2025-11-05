import { stat } from "@tauri-apps/plugin-fs";
import { SizeError } from "../launcher/core/errors";

export async function validateFileSize(path: string, size: number) {
  const file = await stat(path);

  if (file.size != size) {
    throw new SizeError(path, size, file.size);
  }
}