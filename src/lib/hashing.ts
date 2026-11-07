/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { invoke } from "@tauri-apps/api/core";

export const Algorithms = {
  "SHA256": "sha256",
  "SHA1"  : "sha1",
  "MD5"   : "md5",
} as const;

export type HashAlgorithmType = (typeof Algorithms)[keyof typeof Algorithms];

function hashPath(path: string, algorithm: HashAlgorithmType): Promise<string> {
  return invoke<string>("hash_path", { path, algorithm });
}

function hashPayload(payload: Uint8Array | string, algorithm: HashAlgorithmType): Promise<string> {
  const bytes: Uint8Array = typeof payload === "string"
    ? (new TextEncoder).encode(payload)
    : payload;

  switch (algorithm) {
    case Algorithms.SHA256: {
      return invoke<string>("hash_request_sha256", bytes);
    }
    case Algorithms.SHA1: {
      return invoke<string>("hash_request_sha1", bytes);
    }
    case Algorithms.MD5: {
      return invoke<string>("hash_request_md5", bytes);
    }
  }
}

/*
 * Source - https://stackoverflow.com/a/51732778
 * Posted by Mahesh Bongani
 * Retrieved 2026-06-13, License - CC BY-SA 4.0
 */
async function hashOfflineNickname(input: string): Promise<string> {
  const hashed: string = await hashPayload(`OfflinePlayer:${input}`, Algorithms.MD5);
  const bytes: Array<number> = [];

  for (let index = 0; index < hashed.length; index += 2) {
    const byte = Number.parseInt(
      hashed.slice(index, index + 2),
      16,
    );

    bytes.push(byte);
  }

  // Clear version
  bytes[6] = bytes[6] & 0x0F;
  // Set to version 3
  bytes[6] = bytes[6] | 0x30;
  // Clear variant
  bytes[8] = bytes[8] & 0x3F;
  // Set to IETF variant
  bytes[8] = bytes[8] | 0x80;

  return bytes
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  Algorithms,
  hashPath,
  hashPayload,
  hashOfflineNickname,
} as const;
