import { readFile, stat } from "@tauri-apps/plugin-fs";
import { ChecksumError, SizeError } from "./errors";

export async function checksum(path: string, hash: string) {
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

export async function validateFileSize(path: string, size: number) {
  const file = await stat(path);

  if (file.size != size) {
    throw new SizeError(path, size, file.size);
  }
}