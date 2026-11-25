import { expect, test } from "bun:test";

import { cache, encode, Options as options, Raw as raw, sha } from "./cache-fixture.ts";
import { cachedMetadata } from "./index.ts";
import { pinLaunchMetadata } from "./offline.ts";
import { CacheIndex, enableMetadataRetention } from "./storage.ts";

const entry = {
  "url"       : options.url,
  "hash"      : { "kind": "sha256", "sum": sha(raw) },
  "size"      : 1,
  "freshUntil": 0,
};

test("a damaged offline patch defers eviction and allows a fetch", async () => {
  using c = cache();
  const release = pinLaunchMetadata({
    "entry": "net.minecraft", "patchVersions": { "net.minecraft": "1" },
  });

  try {
    const existing = Array.from({ "length": 512 }, (_, index) => [index + ".json", entry]);
    const entries = Object.fromEntries(existing);

    c.files.set(c.root + "index.json", encode(JSON.stringify({ "version": 1, entries })));
    c.files.set(c.root + "net.minecraft/1.json", encode("{}"));
    const fetched = await cachedMetadata(c.request);

    expect(fetched.bytes).toEqual(encode(raw));
    expect(Object.keys(c.index().entries)).toHaveLength(513);
    expect(c.index().entries[options.relativePath].url).toBe(c.request.url);
  } finally {
    release();
  }
});

test("the first hit in an existing oversized index schedules protected eviction", async () => {
  using c = cache();
  const entries = Object.fromEntries(["cold.json", "installed.json", "hit.json"].map(key => {
    c.files.set(c.root + key, encode("1"));

    return [key, entry];
  }));

  c.files.set(c.root + "index.json", encode(JSON.stringify({ "version": 1, entries })));
  const checked = Promise.withResolvers<void>();
  const index = new CacheIndex(c.root.slice(0, -1), async () => {
    checked.resolve();

    return new Set(["installed.json"]);
  }, 2);

  enableMetadataRetention();
  expect(await index.get("hit.json")).toBeDefined();
  expect(c.files.has(c.root + "cold.json")).toBe(true);
  await checked.promise;
  while (Object.keys(c.index().entries).length === 3) await Bun.sleep(1);
  expect(Object.keys(c.index().entries).sort()).toEqual(["hit.json", "installed.json"]);
});

test("an inaccessible eviction candidate stays indexed while another is reclaimed", async () => {
  using c = cache();
  const fs = await import("@tauri-apps/plugin-fs");
  const { spyOn } = await import("bun:test");
  const index = new CacheIndex(c.root.slice(0, -1), async () => new Set, 2);

  for (const name of ["locked.json", "cold.json"]) {
    c.files.set(c.root + name, encode("1"));
    await index.update(name, { ...entry, "hash": { "kind": "sha256", "sum": sha(raw) } });
  }
  using lock = spyOn(fs, "remove").mockRejectedValueOnce(new Error("sharing violation"));
  await index.update("fresh.json", { ...entry, "hash": { "kind": "sha256", "sum": sha(raw) } });
  expect(lock).toHaveBeenCalled();
  expect(Object.keys(c.index().entries).sort()).toEqual(["fresh.json", "locked.json"]);
});

test("missing preview patch bytes preserve known keys without blocking eviction", async () => {
  using c = cache();
  const fs = await import("@tauri-apps/plugin-fs");
  const { spyOn } = await import("bun:test");
  const { "default": browser } = await import("@/lib/browser");
  const { offlineMetadata } = await import("./offline.ts");

  using preview = spyOn(browser, "detectIsBrowser").mockReturnValue(true);
  using missing = spyOn(fs, "readFile").mockResolvedValue(new Uint8Array);
  const release = pinLaunchMetadata({ "entry"        : "net.minecraft",
    "patchVersions": { "net.minecraft": "1" } });

  try {
    const keys = await offlineMetadata(c.root.slice(0, -1));

    expect(keys?.has("net.minecraft/1.json")).toBe(true);
    expect(preview).toHaveBeenCalled();
    expect(missing).toHaveBeenCalled();
  } finally {
    release();
  }
});
