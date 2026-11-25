import "@/extendable/global-object.ts";

import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { expect, mock, spyOn, test } from "bun:test";
import { nextTick, reactive } from "vue";

import Instances from "@/lib/instances";
import Launcher from "@/lib/launcher";
import { globalStates } from "@/states/global.ts";

import { mountComponent, pressEnter } from "./mount-component.ts";
import { useUiState } from "./ui-state.ts";
import { checkViewportFocus } from "./viewport-focus.ts";

useUiState();

const all = Array.from({ "length": 900 }, (_, index) => ({
  "version"    : "version-" + index,
  "type"       : index < 3 ? "release" as const : "snapshot" as const,
  "releaseTime": "2026-11-01T12:34:56Z", "recommended": false, "sha256"     : "",
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
      ["general/base/Checkbox"],
    );
    await Bun.sleep(0);
    const viewport = view.root.querySelector<HTMLElement>(
      dropdown ? "[id$=dropdown-wrapper]" : "[id$=versions-bound]",
    )!;
    const filter = view.root.querySelector<HTMLButtonElement>("[id$=versions-filter]");

    filter?.click();
    await nextTick();
    Object.defineProperty(viewport, "clientHeight", { "value": 256 });
    await checkViewportFocus(view, viewport, dropdown ? "[data-index='44']" : "[id$=checkbox-50]");
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

      expect(first.title).toBe("version-0 · release · 2026-11-01T12:34:56Z");
      expect(first.getAttribute("aria-label")).toBe(first.title);
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
        row.querySelector("button")!.click();
        expect(onToggle).toHaveBeenLastCalledWith("version-" + index, "success");
      }
    }
    client.clear();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
}

for (const dropdown of [true, false]) {
  const selector = dropdown ? "sections/ChangeInstanceVersionDropdown" : "modrinth/VersionScroller";

  for (const empty of [true, false]) {
    test(selector + " restores focus after retry, empty=" + empty, async () => {
      using fetch = spyOn(Launcher.Fetching, "fetchAllVersions")
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(empty ? [] : all);
      const client = new QueryClient({ "defaultOptions": { "queries": { "retry": false } } });
      const onToggle = mock();

      using view = await mountComponent("add-instance/" + selector, {
        "currentPatch"  : "net.minecraft", "currentFilter" : "release", "handleDropdown": mock(),
        "selected"      : [], onToggle,
      }, app => app.use(VueQueryPlugin, { "queryClient": client }), ["general/base/Checkbox"]);
      await Bun.sleep(0);
      expect(view.root.textContent).toContain("Could not load versions");
      const retry = view.root.querySelector<HTMLButtonElement>("[id$=-retry]")!;

      retry.focus();
      pressEnter(view);
      await Bun.sleep(0);
      const focused = view.root.ownerDocument.activeElement as HTMLElement;

      if (empty) {
        expect(focused.matches("p[tabindex]")).toBe(true);
      } else {
        expect(focused.getAttribute("aria-label")).toContain("version-0");
        pressEnter(view);
        if (dropdown) {
          expect(globalStates.pages["add-instance"].instance?.patchVersions["net.minecraft"])
            .toBe("version-0");
        } else {
          expect(onToggle).toHaveBeenCalledWith("version-0", "success");
        }
      }
      expect(fetch).toHaveBeenCalledTimes(2);
      client.clear();
    });
  }
}

for (const open of [false, true]) {
  test("immediate keyboard search selects a matching modloader version, open=" + open, async () => {
    const page = globalStates.pages["add-instance"];

    page.instanceVersionSearch = { "patch": "net.fabricmc.fabric-loader", "input": "" };
    using fetch = spyOn(Launcher.Fetching, "fetchAllVersions").mockResolvedValue(all.slice(0, 3));
    const client = (new QueryClient);

    using cleanup = new DisposableStack;
    const raf = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");

    Object.defineProperty(globalThis, "requestAnimationFrame", {
      "configurable": true, "value": () => 0,
    });
    cleanup.defer(() => {
      if (raf) {
        Object.defineProperty(globalThis, "requestAnimationFrame", raf);
      } else {
        Reflect.deleteProperty(globalThis, "requestAnimationFrame");
      }
    });
    using view = await mountComponent(
      "add-instance/sections/ChangeInstanceVersion",
      {},
      app => app.use(VueQueryPlugin, { "queryClient": client }),
      ["general/base/CustomInput", "add-instance/sections/ChangeInstanceVersionDropdown"],
    );
    const input = view.root.querySelector("input")!;
    const key = (target: Element, value: string): void => {
      target.dispatchEvent(new view.browser.KeyboardEvent("keydown", {
        "key": value, "bubbles": true, "cancelable": true,
      }) as unknown as Event);
    };

    if (!open) {
      page.instanceVersionSearch.patch = "net.minecraft";
      await nextTick();
      input.value = "queued before reset";
      input.dispatchEvent(new view.browser.Event("input") as unknown as Event);
      Instances.resetPageStates();
      await Bun.sleep(320);
      expect(input.value).toBe("");
      expect(page.instanceVersionSearch.input).toBe("");
      input.value = "version-2";
      input.dispatchEvent(new view.browser.Event("input") as unknown as Event);
      view.root.querySelector<HTMLButtonElement>("[id$=version-selected-badge]")!.click();
      await Bun.sleep(320);
      expect(page.instanceVersionSearch.input).toBe("version-2");
      expect(view.root.querySelectorAll("[data-index]")).toHaveLength(1);
      input.value = "stale vanilla";
      input.dispatchEvent(new view.browser.Event("input") as unknown as Event);
      page.instanceVersionSearch = { "patch": "net.fabricmc.fabric-loader", "input": "" };
      await Bun.sleep(320);
      expect(page.instanceVersionSearch.input).toBe("");
    }
    input.focus();
    if (open) {
      input.value = "old loader search";
      input.dispatchEvent(new view.browser.Event("input") as unknown as Event);
      view.root.querySelector<HTMLButtonElement>("[id$=version-selected-badge]")!.click();
      await Bun.sleep(320);
      expect(page.instanceVersionSearch.input).toBe("");
      expect(fetch).toHaveBeenLastCalledWith("net.minecraft", expect.any(String));
      expect(view.root.querySelectorAll("[data-index]")).toHaveLength(3);
      input.click();
      await Bun.sleep(0);
      expect(view.root.querySelectorAll("[data-index]")).toHaveLength(3);
    }
    input.value = "version-2";
    input.dispatchEvent(new view.browser.Event("input", { "bubbles": true }) as unknown as Event);
    key(input, "ArrowDown");
    await Bun.sleep(0);
    const row = view.root.ownerDocument.activeElement!;

    expect(row.getAttribute("aria-label")).toContain("version-2");
    key(row, "Enter");
    await nextTick();
    expect(page.instance?.patchVersions["net.fabricmc.fabric-loader"])
      .toBe("version-2");
    expect(page.instanceVersionSearch.input).toBe("version-2");
    expect(view.root.ownerDocument.activeElement).toBe(input);
    expect(fetch).toHaveBeenLastCalledWith("net.fabricmc.fabric-loader", expect.any(String));
    client.clear();
  });
}
