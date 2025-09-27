import { readFile, stat } from "@tauri-apps/plugin-fs";

export async function checksum(path: string, hash: string): Promise<boolean> {
  const file = await readFile(path);
  const arrayBuffer = file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  );
  const buffer = await crypto.subtle.digest("SHA-1", arrayBuffer);
  const fileHash = [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return fileHash === hash;
}

export async function validateFileSize(path: string, size: number) {
  const file = await stat(path);

  return file.size === size;
}