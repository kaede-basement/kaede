import { readFile } from "@tauri-apps/plugin-fs";

import { ChecksumError } from "../launcher/core/errors";

export async function checksum(path: string, hash: string): Promise<void | ChecksumError> {
  const file = await readFile(path);
  const arrayBuffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  const buffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
  const fileHash = [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  if (fileHash != hash) {
    throw new ChecksumError(path, hash, fileHash);
  }
}