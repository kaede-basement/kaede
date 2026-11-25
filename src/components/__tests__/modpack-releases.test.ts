import "@/extendable/global-object.ts";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { mockIPC } from "@tauri-apps/api/mocks";
import * as fs from "@tauri-apps/plugin-fs";
import * as http from "@tauri-apps/plugin-http";
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { nextTick } from "vue";

import Instances from "@/lib/instances";
import Modrinth from "@/lib/modrinth";
import { installMrpack } from "@/lib/modrinth/install-mrpack.ts";
import { globalStates } from "@/states/global.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { mountComponent, pressEnter } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";
import { checkViewportFocus, scrollViewport } from "./viewport-focus.ts";

useUiState();
let files: DisposableStack;

beforeEach(() => {
  files = new DisposableStack;
  files.use(spyOn(fs, "writeTextFile").mockResolvedValue());
  files.use(spyOn(fs, "remove").mockResolvedValue());
});
afterEach(() => {
  Instances.resetPageStates();
  files.dispose();
});

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
  await checkViewportFocus(view, viewport, "#release-id-40");
  await scrollViewport(view, viewport, (350 * 40) - 320);
  expect(viewport.querySelectorAll("button").length).toBeLessThan(16);
  viewport.querySelector<HTMLButtonElement>("#release-id-349")!.click();
  await Bun.sleep(0);
  expect(fetch).toHaveBeenCalledWith(releases[349].files[0].url);
  expect(globalStates.pages["add-instance"].importedModpack?.path)
    .toMatch(/69642d333439-[0-9a-f]{32}\.mrpack$/);
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
  expect(write.mock.calls[0][0].toString()).toMatch(/69642d31-[0-9a-f]{32}\.mrpack$/);
  expect(peek).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(versions).toHaveBeenCalledTimes(2);
});

const failures = [
  "no URL",
  "503",
  "body unreadable",
  "existing file",
  "disk full",
  "No Modrinth manifest",
  "unreadable manifest",
];

for (const failure of failures) {
  test("release import retries after " + failure, async () => {
    const entry = { ...releases[0], "files": [...releases[0].files] };

    using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue([entry]);
    using fetch = spyOn(http, "fetch");
    const reserve = files.use(spyOn(fs, "writeTextFile"));
    const remove = files.use(spyOn(fs, "remove"));

    using write = spyOn(fs, "writeFile").mockResolvedValue();
    using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
    if (failure === "existing file") reserve.mockRejectedValueOnce(new Error(failure));
    if (failure === "no URL") entry.files = [];
    if (failure === "503") fetch.mockResolvedValueOnce(new Response(null, { "status": 503 }));
    if (failure === "body unreadable") {
      const body = new ReadableStream({ "start": (stream): void => stream.error(failure) });

      fetch.mockResolvedValueOnce(new Response(body));
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
    const written = write.mock.calls[0]?.[0];

    expect(remove.mock.calls).toEqual(written ? [[written]] : []);
    entry.files = releases[0].files;
    button.click();
    await Bun.sleep(0);
    expect(view.root.querySelector("[role=alert]")).toBeNull();
    expect(globalStates.pages["add-instance"].importedModpack?.path)
      .toMatch(/69642d30-[0-9a-f]{32}\.mrpack$/);
    expect(versions).toHaveBeenCalledTimes(1);
  });
}

test("repeat imports preserve previous bytes and distinguish release ID case", async () => {
  const entries = ["A", "a"].map(id => ({ ...releases[0], id }));

  using versions = spyOn(Modrinth, "fetchVersion").mockResolvedValue(entries);
  using fetch = spyOn(http, "fetch").mockResolvedValueOnce(new Response("valid"))
    .mockResolvedValueOnce(new Response("malformed"))
    .mockResolvedValueOnce(new Response("other"));
  const archives = (new Map<string, string>);

  files.use(spyOn(fs, "remove").mockImplementation(async path => {
    archives.delete(String(path));
  }));
  using write = spyOn(fs, "writeFile").mockImplementation(async (path, bytes) => {
    archives.set(String(path), (new TextDecoder).decode(bytes as Uint8Array));
  });
  using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValueOnce(manifest)
    .mockRejectedValueOnce(new Error("malformed"))
    .mockResolvedValueOnce(manifest);
  using view = await mount();
  await Bun.sleep(0);
  const pick = async (id: string): Promise<void> => {
    view.root.querySelector<HTMLButtonElement>("#release-" + id)!.click();
    await Bun.sleep(0);
  };

  await pick("A");
  const original = globalStates.pages["add-instance"].importedModpack!.path;

  await pick("A");
  expect(globalStates.pages["add-instance"].importedModpack!.path).toBe(original);
  expect([...archives.values()]).toEqual(["valid"]);
  await pick("a");
  const names = write.mock.calls.map(([path]) => String(path).toLowerCase());

  expect([...archives.values()]).toEqual(["other"]);
  expect(new Set(names).size).toBe(3);
  expect(names[0]).toMatch(/41-[a-f0-9]+\.mrpack$/);
  expect(names[2]).toMatch(/61-[a-f0-9]+\.mrpack$/);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(peek).toHaveBeenCalledTimes(3);
  expect(versions).toHaveBeenCalledTimes(1);
});

test("an archive superseded during validation is removed; reset waits for its active install",
  async () => {
    files.use(spyOn(Modrinth, "fetchVersion").mockResolvedValue(releases.slice(0, 2)));
    files.use(spyOn(http, "fetch").mockImplementation(async () => new Response("download")));
    using write = spyOn(fs, "writeFile").mockResolvedValue();
    const slow = Promise.withResolvers<typeof manifest>();

    using peek = spyOn(Modrinth, "peekMrpack").mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(manifest);
    const remove = files.use(spyOn(fs, "remove"));

    using first = await mount();
    using second = await mount();
    await Bun.sleep(0);
    first.root.querySelector<HTMLButtonElement>("#release-id-0")!.click();
    await Bun.sleep(0);
    expect(peek).toHaveBeenCalledTimes(1);
    second.root.querySelector<HTMLButtonElement>("#release-id-1")!.click();
    await Bun.sleep(0);
    const [oldPath, newPath] = write.mock.calls.map(([path]) => String(path));

    slow.resolve(manifest);
    await Bun.sleep(0);
    expect(remove.mock.calls).toEqual([[oldPath]]);
    expect(globalStates.pages["add-instance"].importedModpack?.path).toBe(newPath);
    const installed = Promise.withResolvers<void>();

    mockIPC(async command => {
      if (command === "install_mrpack") await installed.promise;
    });
    const installing = installMrpack({
      "archivePath": newPath, "instanceId": "test", "statuses": {} as LauncherStatusesType,
    });

    Instances.resetPageStates();
    expect(remove.mock.calls).toEqual([[oldPath]]);
    installed.resolve();
    await installing;
    expect(remove.mock.calls).toEqual([[oldPath], [newPath]]);
  });

for (const leave of [true, false]) {
  test("release import keyboard retry keeps intended focus, moved outside=" + leave,
    async () => {
      const request = Promise.withResolvers<Response>();

      files.use(spyOn(Modrinth, "fetchVersion").mockResolvedValue(releases));
      using fetch = spyOn(http, "fetch").mockReturnValueOnce(request.promise)
        .mockResolvedValueOnce(new Response("retry"));
      using write = spyOn(fs, "writeFile").mockResolvedValue();
      using peek = spyOn(Modrinth, "peekMrpack").mockResolvedValue(manifest);
      using view = await mount();
      await Bun.sleep(0);
      const document = view.root.ownerDocument;
      const button = view.root.querySelector("button")!;
      const other = document.createElement("button");

      document.body.append(other);
      button.focus();
      pressEnter(view);
      await nextTick();
      expect(button.disabled).toBe(true);
      const viewport = view.root.querySelector<HTMLElement>("#release-viewport")!;

      await scrollViewport(view, viewport, 1600);
      expect(button.isConnected).toBe(false);
      (document.activeElement as HTMLElement).blur();
      if (leave) other.focus();
      const cancel = mock();

      request.resolve(new Response(new ReadableStream({ cancel }), { "status": 503 }));
      await Bun.sleep(0);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(leave ? other : document.getElementById("release-id-40"));
      expect(viewport.scrollTop).toBe(1600);
      pressEnter(view);
      await Bun.sleep(0);
      expect(fetch).toHaveBeenCalledTimes(leave ? 1 : 2);
      expect(peek).toHaveBeenCalledTimes(leave ? 0 : 1);
      expect(write).toHaveBeenCalledTimes(leave ? 0 : 1);
    });
}
