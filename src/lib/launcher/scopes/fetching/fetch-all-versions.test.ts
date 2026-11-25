import * as http from "@tauri-apps/plugin-http";
import { expect, spyOn, test } from "bun:test";

import { CustomPatches, Patches } from "@/constants/meta.ts";

import { fetchAllVersions } from "./fetch-all-versions.ts";

test("empty catalogs succeed, HTTP, network and malformed responses fail", async () => {
  using fetch = spyOn(http, "fetch");
  for (const [uid, empty] of [
    [Patches.Minecraft, { "versions": [] }],
    [CustomPatches.OptiFine, { "msg": "no such optifine" }],
  ] as const) {
    fetch.mockResolvedValueOnce(Response.json(empty));
    expect(await fetchAllVersions(uid, "1.0")).toEqual([]);
    fetch.mockResolvedValueOnce(Response.json(empty, { "status": 503 }));
    await expect(fetchAllVersions(uid, "1.0")).rejects.toThrow("HTTP 503");
    fetch.mockRejectedValueOnce(new Error("network unavailable"));
    await expect(fetchAllVersions(uid, "1.0")).rejects.toThrow("network unavailable");
    fetch.mockResolvedValueOnce(Response.json({ "msg": "unexpected response" }));
    await expect(fetchAllVersions(uid, "1.0")).rejects.toThrow();
  }
});
