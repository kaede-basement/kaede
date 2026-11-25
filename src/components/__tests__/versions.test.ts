import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { expect, mock, spyOn, test } from "bun:test";
import { nextTick, reactive } from "vue";

import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";

import { mountComponent } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";

useUiState();

const all = Array.from({ "length": 900 }, (_, index) => ({
  "version"    : "version-" + index,
  "type"       : index < 3 ? "release" as const : "snapshot" as const,
  "releaseTime": "", "recommended": false, "sha256"     : "",
}));

for (const dropdown of [true, false]) {
  const selector = dropdown ? "ChangeInstanceVersionDropdown" : "VersionScroller";

  test(selector + " scrolls 900 versions and selects every remaining filtered row", async () => {
    using fetch = spyOn(Launcher.Fetching, "fetchAllVersions").mockResolvedValue(all);
    const onToggle = mock();
    const properties = reactive({
      "currentPatch"  : "net.minecraft", "currentFilter" : "all", "handleDropdown": mock(),
      "selected"      : [], onToggle,
    });
    const client = new QueryClient({ "defaultOptions": { "queries": { "retry": false } } });

    using view = await mountComponent(
      "add-instance/" + (dropdown ? "sections/" : "modrinth/") + selector,
      properties,
      app => app.use(VueQueryPlugin, { "queryClient": client }),
    );
    await Bun.sleep(0);
    const viewport = view.root.querySelector<HTMLElement>(
      dropdown ? "[id$=dropdown-wrapper]" : "[id$=versions-bound]",
    )!;
    const filter = view.root.querySelector<HTMLButtonElement>("[id$=versions-filter]");

    filter?.click();
    await nextTick();
    Object.defineProperty(viewport, "clientHeight", { "value": 256 });
    viewport.scrollTop = (900 * (dropdown ? 36 : 32)) - 256;
    viewport.dispatchEvent(new view.browser.Event("scroll") as unknown as Event);
    await nextTick();
    const rows = (): Array<HTMLElement> => [...viewport.querySelectorAll<HTMLElement>(
      dropdown ? "[data-index]" : "label",
    )];

    expect(rows().length).toBeLessThan(16);
    expect(rows()[rows().length - 1]?.textContent).toContain("version-899");
    properties.currentFilter = "release";
    filter?.click();
    await nextTick();
    expect(viewport.scrollTop).toBe(0);
    expect(rows()).toHaveLength(3);
    if (dropdown) {
      const [first, second, third] = rows();

      first.focus();
      first.dispatchEvent(
        new view.browser.KeyboardEvent("keydown", { "key": "ArrowDown" }) as unknown as Event,
      );
      expect(view.root.ownerDocument.activeElement).toBe(second);
      first.dispatchEvent(
        new view.browser.PointerEvent("pointerdown", { "button": 0 }) as unknown as Event,
      );
      third.dispatchEvent(
        new view.browser.PointerEvent("pointerover", { "buttons": 1 }) as unknown as Event,
      );
      expect(globalStates.pages["add-instance"].instance?.patchVersions["net.minecraft"])
        .toBe("version-2");
      third.dispatchEvent(
        new view.browser.PointerEvent("pointerup", { "button": 0 }) as unknown as Event,
      );
      expect(properties.handleDropdown).toHaveBeenCalledTimes(1);
    }
    for (const [index, row] of rows().entries()) {
      if (dropdown) {
        row.click();
        expect(globalStates.pages["add-instance"].instance?.patchVersions["net.minecraft"])
          .toBe("version-" + index);
      } else {
        Reflect.get(row.querySelector("test-child")!, "on-toggle")();
        expect(onToggle).toHaveBeenLastCalledWith("version-" + index, "success");
      }
    }
    client.clear();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
}

test("version dropdown offers retry after fetch failure", async () => {
  using fetch = spyOn(Launcher.Fetching, "fetchAllVersions")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(all);
  const client = new QueryClient({ "defaultOptions": { "queries": { "retry": false } } });

  using view = await mountComponent("add-instance/sections/ChangeInstanceVersionDropdown", {
    "currentPatch": "net.minecraft", "currentFilter": "release", "handleDropdown": mock(),
  }, app => app.use(VueQueryPlugin, { "queryClient": client }));
  await Bun.sleep(0);
  expect(view.root.textContent).toContain("Could not load versions");
  view.root.querySelector<HTMLButtonElement>("#__version-dropdown-retry")!.click();
  await Bun.sleep(0);
  expect(view.root.querySelectorAll("[data-index]")).toHaveLength(3);
  expect(fetch).toHaveBeenCalledTimes(2);
  client.clear();
});
