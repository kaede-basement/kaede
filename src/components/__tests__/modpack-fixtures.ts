import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mock } from "bun:test";

import { mountComponent } from "./mount-component.ts";

export const releases = Array.from({ "length": 350 }, (_, n) => ({
  "id"            : "id-" + n,
  "name"          : "Release " + n,
  "version_number": "1",
  "game_versions" : ["1.20"],
  "loaders"       : ["fabric" as const],
  "featured"      : false,
  "files"         : [{ "url": "https://example.org/" + n }],
}));
export const manifest = {
  "formatVersion": 1,
  "versionId"    : "1",
  "name"         : "Pack",
  "files"        : [],
  "overrides"    : 0,
  "summary"      : null,
  "dependencies" : { "minecraft": "1.20" },
};

export const mountReleasePicker = (): ReturnType<typeof mountComponent> => mountComponent(
  "add-instance/modrinth/ModpackVersionSelector", {
    "idRoot": "release", "projectId": "project", "projectIcon": null, "close": mock(),
  }, app => app.use(VueQueryPlugin, { "queryClient": (new QueryClient) }));
