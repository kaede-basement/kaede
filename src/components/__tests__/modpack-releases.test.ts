import "@/extendable/global-object.ts";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import * as fs from "@tauri-apps/plugin-fs";
import * as http from "@tauri-apps/plugin-http";
import { expect, mock, spyOn, test } from "bun:test";
import { nextTick } from "vue";

import Modrinth from "@/lib/modrinth";
import { globalStates } from "@/states/global.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();
const releases = Array.from({ "length": 350 }, (_, n) => ({
  "id"            : "id-" + n,
  "name"          : "Release " + n,
  "version_number": "1",
  "game_versions" : ["1.20"],
  "loaders"       : ["fabric" as const],
  "featured"      : false,
  "files"         : [{ "url": "https://example.org/" + n }],
}));
const manifest = {
  "formatVersion": 1,
  "versionId"    : "1",
  "name"         : "Pack",
  "files"        : [],
  "overrides"    : 0,
  "summary"      : null,
  "dependencies" : { "minecraft": "1.20" },
};
const mount = (): ReturnType<typeof mountComponent> => mountComponent(
  "add-instance/modrinth/ModpackVersionSelector", {
    "idRoot": "release", "projectId": "project", "projectIcon": null, "close": mock(),
  }, app => app.use(VueQueryPlugin, { "queryClient": (new QueryClient) }));

test("project releases window and select the last release", async () => {
  using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue(releases);
  using fetch = spyOn(http, "fetch").mockResolvedValue(new Response("last"));
  using write = spyOn(fs, "writeFile").mockResolvedValue();
  using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
  using view = await mount();
  await Bun.sleep(0);
  const viewport = view.root.querySelector<HTMLElement>("#release-viewport")!;

  Object.defineProperty(viewport, "clientHeight", { "value": 320 });
  viewport.scrollTop = (350 * 40) - 320;
  viewport.dispatchEvent(new view.browser.Event("scroll") as unknown as Event);
  await nextTick();
  expect(viewport.querySelectorAll("button").length).toBeLessThan(16);
  viewport.querySelector<HTMLButtonElement>("#release-id-349")!.click();
  await Bun.sleep(0);
  expect(fetch).toHaveBeenCalledWith(releases[349].files[0].url);
  expect(globalStates.pages["add-instance"].importedModpack?.path).toEndWith("id-349.mrpack");
  expect(write).toHaveBeenCalledTimes(1);
  expect(peek).toHaveBeenCalledTimes(1);
  expect(versions).toHaveBeenCalledTimes(1);
});

test("superseded release cannot publish after a newer identically numbered release", async () => {
  using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue(releases.slice(0, 2));
  const older = Promise.withResolvers<Response>();

  using fetch = spyOn(http, "fetch").mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce(new Response("newer"));
  using write = spyOn(fs, "writeFile").mockResolvedValue();
  using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
  using first = await mount();
  using second = await mount();
  await Bun.sleep(0);
  first.root.querySelector<HTMLButtonElement>("#release-id-0")!.click();
  second.root.querySelector<HTMLButtonElement>("#release-id-1")!.click();
  await Bun.sleep(0);
  older.resolve(new Response("older"));
  await Bun.sleep(0);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0].toString()).toEndWith("id-1.mrpack");
  expect(peek).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(versions).toHaveBeenCalledTimes(2);
});

const failures = [
  "no URL", "503", "body unreadable", "disk full", "No Modrinth manifest", "unreadable manifest",
];

for (const failure of failures) {
  test("release import retries after " + failure, async () => {
    const entry = { ...releases[0], "files": [...releases[0].files] };

    using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue([entry]);
    using fetch = spyOn(http, "fetch");
    using write = spyOn(fs, "writeFile").mockResolvedValue();
    using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
    if (failure === "no URL") entry.files = [];
    if (failure === "503") fetch.mockResolvedValueOnce(new Response(null, { "status": 503 }));
    if (failure === "body unreadable") {
      const response = new Response("unreadable");

      response.bytes = async (): Promise<never> => {
        throw new Error(failure);
      };
      fetch.mockResolvedValueOnce(response);
    }
    if (failure === "disk full") write.mockRejectedValueOnce(new Error(failure));
    if (failure === "No Modrinth manifest") {
      peek.mockImplementationOnce(async (): Promise<undefined> => {});
    }
    if (failure === "unreadable manifest") peek.mockRejectedValueOnce(new Error(failure));
    fetch.mockImplementation(async () => new Response("pack"));
    using view = await mount();
    await Bun.sleep(0);
    const button = view.root.querySelector<HTMLButtonElement>("button")!;

    button.click();
    await Bun.sleep(0);
    expect(view.root.querySelector("[role=alert]")?.textContent)
      .toContain(failure === "no URL" ? "no archive URL" : failure);
    expect(button.disabled).toBe(false);
    entry.files = releases[0].files;
    button.click();
    await Bun.sleep(0);
    expect(view.root.querySelector("[role=alert]")).toBeNull();
    expect(globalStates.pages["add-instance"].importedModpack?.path).toEndWith("id-0.mrpack");
    expect(versions).toHaveBeenCalledTimes(1);
  });
}
