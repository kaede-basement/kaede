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

import Hashing, { Algorithms } from "@/lib/hashing.ts";

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCodePoint(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * PKCE (RFC 7636)
 */
export async function createPkcePair(): Promise<{
  "verifier" : string;
  "challenge": string;
  "method"   : "S256";
}> {
  const randomBytes: Uint8Array = crypto.getRandomValues(new Uint8Array(32));
  const verifier: string = toBase64Url(randomBytes);

  let digest: Uint8Array;

  if (crypto.subtle) {
    const encoded = (new TextEncoder).encode(verifier);

    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoded));
  } else {
    // WebKit can expose getRandomValues without exposing SubtleCrypto.
    const hex = await Hashing.hashPayload(verifier, Algorithms.SHA256);

    digest = Uint8Array.from(hex.match(/../g)!, byte => Number.parseInt(byte, 16));
  }

  return {
    verifier,
    "challenge": toBase64Url(digest),
    "method"   : "S256",
  };
}
