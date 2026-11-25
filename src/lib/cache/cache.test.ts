import * as fs from "@tauri-apps/plugin-fs";
import * as http from "@tauri-apps/plugin-http";
import { expect, type Mock, spyOn, test } from "bun:test";

import * as paths from "@/lib/file-manager/path.ts";

import { cachedMetadata } from "./index.ts";
import type { Entry } from "./storage.ts";

const raw = "{ \"version\": 1 }\n";

function encode(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array((new TextEncoder).encode(value));
}
const sha = (value: string): string => new Bun.CryptoHasher("sha256").update(value)
  .digest("hex");
const options = {
  "url"         : "https://example.org/meta.json",
  "relativePath": "package/version.json",
};

type Index = { "version": number; "entries": Record<string, Entry> };
function cache(): Disposable & {
  "request": typeof options & { "baseDirectory": string };
  "root"   : string;
  "path"   : string;
  "files"  : Map<string, Uint8Array<ArrayBuffer>>;
  "fetch"  : Mock<typeof http.fetch>;
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
  const fetch = mocks.use(spyOn(http, "fetch").mockImplementation(async () => new Response(raw)));
  const baseDirectory = crypto.randomUUID();
  const request = { ...options, baseDirectory };
  const root = baseDirectory + "/cache/";
  const path = root + options.relativePath;
  const index = (): Index => JSON.parse((new TextDecoder).decode(files.get(root + "index.json")));

  return {
    request, root, path, files, fetch, index,
    [Symbol.dispose]: (): void => mocks.dispose(),
  };
}

test("publishes the verified upstream bytes and records their exact digest", async () => {
  using c = cache();
  await cachedMetadata({ ...c.request, "expectedHash": { "kind": "sha256", "sum": sha(raw) } });
  expect(c.files.get(c.path)).toEqual(encode(raw));
  expect(c.index()).toMatchObject({ "version": 1, "entries": { [options.relativePath]: {
    "size": encode(raw).length, "hash": { "kind": "sha256", "sum": sha(raw) },
  } } });
});

test("a failed refresh preserves both files", async () => {
  using c = cache();
  await cachedMetadata({ ...c.request, "ttl": 0 });
  const original = new Map(c.files);

  for (const status of [404, 500]) {
    c.fetch.mockResolvedValueOnce(new Response("{\"error\":\"gone\"}", { status }));
    await expect(cachedMetadata(c.request)).rejects.toThrow(`HTTP ${status}`);
  }
  await expect(cachedMetadata({ ...c.request, "validate": () => false }))
    .rejects.toThrow("Invalid");
  await expect(cachedMetadata({ ...c.request, "expectedHash": {
    "kind": "sha256", "sum": sha("different"),
  } })).rejects.toThrow("digest");
  await expect(cachedMetadata({ ...c.request, "expectedSize": 1 })).rejects.toThrow("size");
  c.fetch.mockRejectedValueOnce(new Error("offline"));
  await expect(cachedMetadata(c.request)).rejects.toThrow("offline");
  expect(c.files).toEqual(original);
});

test("304 renews a checked file or retries without validators", async () => {
  using c = cache();
  const headers = { "etag"         : "W/\"meta\"", "last-modified": new Date(0).toUTCString(),
    "cache-control": "no-cache" };

  c.fetch.mockResolvedValueOnce(new Response(raw, { headers }));
  await cachedMetadata(c.request);
  for (const state of ["good", "missing", "damaged"]) {
    if (state === "missing") c.files.delete(c.path);
    if (state === "damaged") c.files.set(c.path, encode(raw.replace("1", "9")));
    c.fetch.mockClear();
    c.fetch.mockResolvedValueOnce(new Response(null, { "status" : 304,
      "headers": { "cache-control": state === "damaged" ? "max-age=60" : "no-cache" } }));
    c.fetch.mockResolvedValue(new Response(raw, { headers }));
    const result = await cachedMetadata(c.request);

    expect(result.data).toEqual({ "version": 1 });
    const sent = new Headers(c.fetch.mock.calls[0][1]?.headers);

    expect(sent.get("if-none-match")).toBe(headers.etag);
    expect(sent.get("if-modified-since")).toBe(headers["last-modified"]);
    expect(c.fetch).toHaveBeenCalledTimes(state === "good" ? 1 : 2);
    if (state !== "good") expect(c.fetch.mock.lastCall?.[1]).toBeUndefined();
  }
  c.fetch.mockResolvedValueOnce(new Response(null, { "status" : 304,
    "headers": { "cache-control": "max-age=60" } }));
  await cachedMetadata(c.request);
  expect(c.index().entries[options.relativePath].freshUntil).toBeGreaterThan(Date.now());
});

test("changed parents and legacy formatting invalidate fresh entries", async () => {
  using c = cache();
  const pinned = {
    ...c.request,
    "expectedHash": { "kind": "sha256", "sum": sha(raw) },
  } as const;

  c.files.set(c.path, encode(JSON.stringify(JSON.parse(raw), null, 2)));
  await cachedMetadata(pinned);
  await cachedMetadata(pinned);
  expect(c.fetch).toHaveBeenCalledTimes(1);
  const next = "{\"version\":2}";

  c.fetch.mockResolvedValueOnce(new Response(next));
  await cachedMetadata({ ...pinned, "expectedHash": { "kind": "sha256", "sum": sha(next) } });
  expect(c.files.get(c.path)).toEqual(encode(next));
});

test("parallel destinations merge and identical requests share one GET", async () => {
  using c = cache();
  await Promise.all([cachedMetadata(c.request),
    cachedMetadata(c.request),
    cachedMetadata({ ...c.request, "relativePath": "other.json" })]);
  expect(Object.keys(c.index().entries).sort()).toEqual(["other.json", options.relativePath]);
  expect(c.fetch).toHaveBeenCalledTimes(2);
});

test("unsafe destinations and malformed digests are rejected before any fetch", async () => {
  using c = cache();
  for (const relativePath of ["../a.json",
    "/a.json",
    "C:/a.json",
    String.raw`a\b.json`,
    "./a.json",
    "sub/../a.json",
    "index.json",
    "CON.json",
    "x./y.json"]) {
    await expect(cachedMetadata({ ...c.request, relativePath }))
      .rejects.toThrow("Invalid");
  }
  for (const sum of ["", "0".repeat(63), "z".repeat(64)]) {
    await expect(cachedMetadata({ ...c.request, "expectedHash": {
      "kind": "sha256", sum,
    } }))
      .rejects.toThrow("Invalid");
  }
  expect(c.fetch).not.toHaveBeenCalled();
});

test("corrupt index is disposable and no-store removes the old cached representation", async () => {
  using c = cache();
  c.files.set(c.root + "index.json", encode("{"));
  const expires = new Date(Date.now() - 60_000).toUTCString();

  c.fetch.mockResolvedValueOnce(new Response(raw, { "headers": { expires } }));
  await cachedMetadata(c.request);
  expect(c.index().entries[options.relativePath].freshUntil).toBe(Date.parse(expires));
  c.fetch.mockResolvedValueOnce(new Response("42", { "headers": { "cache-control": "no-store" } }));
  const result = await cachedMetadata(c.request);

  expect(result.data).toBe(42);
  expect(c.files.has(c.path)).toBe(false);
  expect(c.index().entries).toEqual({});
});

test("an offline pinned version adopts its validated fresh legacy patch", async () => {
  using c = cache();
  c.files.set(c.path, encode(raw));
  const mtime = (new Date);

  using stat = spyOn(fs, "stat").mockResolvedValue({ mtime } as fs.FileInfo);
  const result = await cachedMetadata({
    ...c.request, "adoptLegacyPatch": true, "validate": value => typeof value === "object",
  });

  expect(result.data).toEqual({ "version": 1 });
  expect(c.index().entries[options.relativePath].hash.sum).toBe(sha(raw));
  expect(stat).toHaveBeenCalledWith(c.path);
  expect(c.fetch).not.toHaveBeenCalled();
});

test("rejects a symlinked cache directory before fetching", async () => {
  using c = cache();
  using lstat = spyOn(fs, "lstat").mockResolvedValue({ "isSymlink": true } as fs.FileInfo);
  await expect(cachedMetadata(c.request)).rejects.toThrow("Symbolic link");
  expect(lstat).toHaveBeenCalled();
  expect(c.fetch).not.toHaveBeenCalled();
});

test("expired SHA-1 pins reuse exact bytes offline and reject same-size damage", async () => {
  using c = cache();
  const sum = new Bun.CryptoHasher("sha1").update(raw)
    .digest("hex");
  const request = {
    ...c.request, "ttl"         : 0, "expectedSize": encode(raw).length,
    "expectedHash": { "kind": "sha1", sum },
  } as const;

  await cachedMetadata(request);
  expect(c.index().entries[options.relativePath].freshUntil).toBe(0);
  c.fetch.mockRejectedValue(new Error("offline"));
  await cachedMetadata(request);
  expect(c.fetch).toHaveBeenCalledTimes(1);
  c.files.set(c.path, encode(raw.replace("1", "2")));
  await expect(cachedMetadata(request)).rejects.toThrow("offline");
});

test("competing URLs at one destination publish in request order", async () => {
  using c = cache();
  c.fetch.mockImplementation(async url => new Response(JSON.stringify({ url })));
  const other = { ...c.request, "url": "https://example.org/replacement" };
  const [first, second] = await Promise.all([cachedMetadata(c.request), cachedMetadata(other)]);

  expect(first.data).toEqual({ "url": c.request.url });
  expect(second.data).toEqual({ "url": other.url });
  expect(c.index().entries[options.relativePath].url).toBe(other.url);
  expect(c.files.get(c.path)).toEqual(second.bytes);
});
