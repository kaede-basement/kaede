import { expect, spyOn, test } from "bun:test";

import { cache, encode, Options, Raw, sha } from "./cache-fixture.ts";
import { cachedMetadata } from "./index.ts";

test("Age reduces max-age and a 304 retains the original lifetime", async () => {
  using c = cache();
  const start = Date.parse("2026-01-01T00:00:00Z");

  using clock = spyOn(Date, "now").mockReturnValue(start);
  c.fetch.mockResolvedValueOnce(new Response(Raw, { "headers": {
    "cache-control": "max-age=30", "age": "20", "etag": "\"one\"",
  } }));
  await cachedMetadata(c.request);
  expect(c.index().entries[Options.relativePath].freshUntil).toBe(start + 10_000);
  clock.mockReturnValue(start + 10_000);
  c.fetch.mockResolvedValueOnce(new Response(null, { "status": 304 }));
  await cachedMetadata(c.request);
  expect(c.index().entries[Options.relativePath].freshUntil).toBe(start + 40_000);
});

test("Expires uses the server's Date and accounts for Age", async () => {
  using c = cache();
  const start = Date.parse("2026-01-01T00:00:00Z");

  using clock = spyOn(Date, "now").mockReturnValue(start);
  c.fetch.mockResolvedValueOnce(new Response(Raw, { "headers": {
    "date"   : new Date(start + 60_000).toUTCString(),
    "expires": new Date(start + 90_000).toUTCString(),
    "age"    : "5",
  } }));
  await cachedMetadata(c.request);
  expect(c.index().entries[Options.relativePath].freshUntil).toBe(clock() + 25_000);
});

test("pinned no-cache revalidates even after a 304 omits policy; offline checks parent digest",
  async () => {
    using c = cache();
    const pinned = { ...c.request, "expectedHash": { "kind": "sha256", "sum": sha(Raw) } } as const;

    c.fetch.mockResolvedValueOnce(new Response(Raw, { "headers": {
      "cache-control": "no-cache", "etag": "\"1\"",
    } }));
    await cachedMetadata(pinned);
    c.fetch.mockResolvedValueOnce(new Response(null, { "status": 304 }));
    await cachedMetadata(pinned);
    expect(new Headers(c.fetch.mock.lastCall?.[1]?.headers).get("if-none-match")).toBe("\"1\"");
    c.fetch.mockRejectedValue(new Error("offline"));
    const stale = await cachedMetadata(pinned);

    expect(c.fetch).toHaveBeenCalledTimes(3);
    expect(stale.bytes).toEqual(encode(Raw));
    const changed = { ...pinned, "expectedHash": { "kind": "sha256", "sum": sha("new") } } as const;

    await expect(cachedMetadata(changed))
      .rejects.toThrow("offline");
  });

test("offline game index must match its parent digest, size and schema", async () => {
  using c = cache();
  const fallbackPath = c.request.baseDirectory + "/assets/indexes/1.json";
  const sum = new Bun.CryptoHasher("sha1").update(Raw)
    .digest("hex");
  const request = { ...c.request, fallbackPath, "expectedSize": Raw.length,
    "expectedHash": { "kind": "sha1", sum },
    "validate"    : (value: unknown): boolean => typeof value === "object" } as const;

  c.files.set(fallbackPath, encode(Raw));
  c.fetch.mockRejectedValue(new Error("offline"));
  const valid = await cachedMetadata(request);

  expect(valid.data).toEqual({ "version": 1 });
  await expect(cachedMetadata({ ...request, "expectedSize": 2 })).rejects.toThrow("offline");
  await expect(cachedMetadata({ ...request, "validate": () => false })).rejects.toThrow("offline");
  c.files.set(fallbackPath, encode(Raw.replace("1", "2")));
  await expect(cachedMetadata(request)).rejects.toThrow("offline");
  c.fetch.mockResolvedValueOnce(new Response(Raw));
  const repaired = await cachedMetadata(request);

  expect(repaired.bytes).toEqual(encode(Raw));
});

test("invalid stored validators heal through an unconditional GET", async () => {
  for (const header of [{ "etag": "\r\n" }, { "lastModified": "snowman ☃" }]) {
    using c = cache();
    const entry = { "url"       : c.request.url, "freshUntil": 0, "size"      : Raw.length,
      "hash"      : { "kind": "sha256", "sum": sha(Raw) }, ...header };

    c.files.set(c.root + "index.json", encode(JSON.stringify({
      "version": 1, "entries": { [Options.relativePath]: entry },
    })));
    await cachedMetadata(c.request);
    expect([...new Headers(c.fetch.mock.lastCall?.[1]?.headers)]).toEqual([]);
    expect(c.index().entries[Options.relativePath].etag).toBeUndefined();
    expect(c.index().entries[Options.relativePath].lastModified).toBeUndefined();
  }
});
