import { expect, spyOn, test } from "bun:test";

import { CustomPatches, Patches } from "@/constants/meta.ts";
import { loadEruda } from "@/lib/development-mode/load-eruda.ts";
import * as paths from "@/lib/file-manager/path.ts";
import { fetchAllVersions } from "@/lib/launcher/scopes/fetching/fetch-all-versions.ts";
import { fetchVersion } from "@/lib/modrinth/fetch-version.ts";
import { getProjectBody } from "@/lib/modrinth/get-project-body.ts";

import { cache } from "./cache-fixture.ts";
import { cachedMetadata } from "./index.ts";

const modrinth = {
  "id"            : "id",
  "name"          : "version",
  "version_number": "1",
  "loaders"       : ["fabric"],
  "game_versions" : ["1"],
  "featured"      : false,
  "files"         : [],
};

test("version pickers cache complete documents before filtering", async () => {
  using c = cache();
  using base = spyOn(paths, "getBaseDirectory").mockReturnValue(c.request.baseDirectory);
  const uid = Patches.FabricLoader;
  const versions = ["1", "2"].map(version => ({
    version, "sha256"     : "a".repeat(64), "recommended": false, "releaseTime": "2024-01-01",
    "requires"   : [{ "uid": Patches.Minecraft, "equals": version }],
  }));

  c.fetch.mockResolvedValueOnce(Response.json({ versions }));
  expect(await fetchAllVersions(uid, "1")).toEqual([versions[0]]);
  expect(await fetchAllVersions(uid, "2")).toEqual([versions[1]]);
  expect(c.files.has(c.root + uid + ".json")).toBe(true);
  c.fetch.mockResolvedValueOnce(Response.json({ "body": "overview" }));
  c.fetch.mockResolvedValueOnce(Response.json([modrinth]));
  for (let index = 0; index < 2; index++) {
    expect(await getProjectBody("my-pack")).toBe("overview");
    const [version] = await fetchVersion("my-pack");

    expect(version.name).toBe("version");
  }
  expect(c.fetch).toHaveBeenCalledTimes(3);
  expect(base).toHaveBeenCalled();
});

test("HTTP errors never execute Eruda or parse an OptiFine error page", async () => {
  using c = cache();

  using base = spyOn(paths, "getBaseDirectory").mockReturnValue(c.request.baseDirectory);

  c.fetch.mockImplementation(async () => new Response("INVALID!", { "status": 503 }));
  await expect(loadEruda()).rejects.toThrow("503");
  await expect(fetchAllVersions(CustomPatches.OptiFine, "1")).rejects.toThrow("503");
  expect(base).toHaveBeenCalled();
});

test("each picker rejects malformed rows and accepts the next valid document", async () => {
  using c = cache();
  using base = spyOn(paths, "getBaseDirectory").mockReturnValue(c.request.baseDirectory);
  const patch = {
    "version": "1", "releaseTime": "2024-01-01", "recommended": true, "sha256": "a".repeat(64),
  };

  type Rows = Promise<Array<unknown>>;
  type Case = [() => Rows, string, unknown, unknown];
  const cases: Array<Case> = [
    [(): Rows => fetchVersion("bad"),
      "modrinth/bad/versions.json",
      [{ "name": "version" }],
      [modrinth]],
    [(): Rows => fetchAllVersions(Patches.Minecraft),
      Patches.Minecraft + ".json",
      { "versions": [patch, null] },
      { "versions": [patch] }],
    [(): Rows => fetchAllVersions(CustomPatches.OptiFine, "1"),
      "bmclapi/optifine/1.json",
      [null],
      [{ "type": "HD_U", "patch": "I1" }]],
  ];

  for (const [read, relativePath, bad, good] of cases) {
    const before = new Map(c.files);

    c.fetch.mockResolvedValueOnce(Response.json(bad));
    await expect(read()).rejects.toThrow("Invalid metadata");
    expect(c.files).toEqual(before);
    // Seed a fresh entry admitted by the previous, weaker validator.
    const url = c.fetch.mock.lastCall![0];

    c.fetch.mockResolvedValueOnce(Response.json(bad));
    await cachedMetadata({ ...c.request, relativePath, url });
    c.fetch.mockClear();
    c.fetch.mockResolvedValueOnce(Response.json(good));
    expect(await read()).toHaveLength(1);
    expect(c.fetch).toHaveBeenCalledTimes(1);
  }
  expect(base).toHaveBeenCalled();
});
