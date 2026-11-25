import * as http from "@tauri-apps/plugin-http";
import { expect, mock, spyOn, test } from "bun:test";

import { LaunchStatus } from "@/constants/launcher.ts";
import { Patches } from "@/constants/meta.ts";
import { CancelledDownload } from "@/lib/launcher/scopes/fetching/download-outcome.ts";
import { fetchAllVersions } from "@/lib/launcher/scopes/fetching/fetch-all-versions.ts";
import { fetchMetadata } from "@/lib/launcher/scopes/fetching/fetch-metadata.ts";
import { fetchVersion } from "@/lib/modrinth/fetch-version.ts";

const metadata = {
  "url": "https://example.org/index", "label": "metadata", "prefix": "", "scope": "PatchIndex",
} as const;

test("catalog, project release and metadata HTTP errors release each unread response", async () => {
  const cancel = mock();

  using fetch = spyOn(http, "fetch").mockImplementation(async () => new Response(
    new ReadableStream({ cancel }), { "status": 503 },
  ));

  await expect(fetchAllVersions(Patches.Minecraft)).rejects.toThrow("503");
  await expect(fetchVersion("project")).rejects.toThrow("503");
  expect(await fetchMetadata(metadata)).toBe(LaunchStatus.PatchIndex.FailedToFetch);
  expect(cancel).toHaveBeenCalledTimes(3);
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("metadata drops the body when Stop arrives as headers resolve", async () => {
  const controller = new AbortController;
  const cancel = mock(() => Promise.reject(new Error("already closed")));
  const headers = Promise.withResolvers<Response>();

  using fetch = spyOn(http, "fetch").mockReturnValue(headers.promise);
  const result = fetchMetadata({ ...metadata, "signal": controller.signal });

  controller.abort();
  headers.resolve(new Response(new ReadableStream({ cancel })));
  await expect(result).rejects.toBeInstanceOf(CancelledDownload);
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(1);
});
