import { expect, spyOn, test } from "bun:test";

import { CustomPatches, Patches } from "@/constants/meta.ts";
import { loadEruda } from "@/lib/development-mode/load-eruda.ts";
import * as paths from "@/lib/file-manager/path.ts";
import { fetchAllVersions } from "@/lib/launcher/scopes/fetching/fetch-all-versions.ts";
import { fetchVersion } from "@/lib/modrinth/fetch-version.ts";
import { getProjectBody } from "@/lib/modrinth/get-project-body.ts";

import { cache } from "./cache-fixture.ts";

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
  c.fetch.mockResolvedValueOnce(Response.json([{ "name": "version" }]));
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
