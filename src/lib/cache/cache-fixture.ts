import * as fs from "@tauri-apps/plugin-fs";
import { type Mock, spyOn } from "bun:test";

import * as paths from "@/lib/file-manager/path.ts";
import * as http from "@/lib/network/fetch-document.ts";

import type { Entry } from "./storage.ts";

export const Raw = "{ \"version\": 1 }\n";

export function encode(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array((new TextEncoder).encode(value));
}
export function sha(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value)
    .digest("hex");
}
export const Options = {
  "url"         : "https://example.org/meta.json",
  "relativePath": "package/version.json",
};

type Index = { "version": number; "entries": Record<string, Entry> };
export function cache(): Disposable & {
  "request": typeof Options & { "baseDirectory": string };
  "root"   : string;
  "path"   : string;
  "files"  : Map<string, Uint8Array<ArrayBuffer>>;
  "fetch"  : Mock<typeof http.fetchDocument>;
  "index"  : () => Index;
} {
  const files = (new Map<string, Uint8Array<ArrayBuffer>>);
  const mocks = (new DisposableStack);

  mocks.use(spyOn(paths, "join").mockImplementation((...parts) => parts.join("/")));
  mocks.use(spyOn(fs, "readFile").mockImplementation(async path => {
    const bytes = files.get(String(path));

    if (!bytes) throw new Error("missing");

    return bytes;
  }));
  mocks.use(spyOn(fs, "exists").mockImplementation(async path => files.has(String(path))));
  mocks.use(spyOn(fs, "lstat").mockResolvedValue({ "isSymlink": false } as fs.FileInfo));
  mocks.use(spyOn(fs, "mkdir").mockResolvedValue());
  mocks.use(spyOn(fs, "writeFile").mockImplementation(async (path, bytes) => {
    files.set(String(path), bytes as Uint8Array<ArrayBuffer>);
  }));
  mocks.use(spyOn(fs, "rename").mockImplementation(async (from, to) => {
    files.set(String(to), files.get(String(from))!);
    files.delete(String(from));
  }));
  mocks.use(spyOn(fs, "remove").mockImplementation(async path => {
    files.delete(String(path));
  }));
  const fetch = mocks.use(spyOn(http, "fetchDocument")
    .mockImplementation(async () => new Response(Raw)));
  const baseDirectory = crypto.randomUUID();
  const request = { ...Options, baseDirectory };
  const root = baseDirectory + "/cache/";
  const path = root + Options.relativePath;
  const index = (): Index => JSON.parse((new TextDecoder).decode(files.get(root + "index.json")));

  return {
    request, root, path, files, fetch, index,
    [Symbol.dispose]: (): void => mocks.dispose(),
  };
}
