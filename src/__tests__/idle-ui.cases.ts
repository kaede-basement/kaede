import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { nextTick, reactive, type Ref } from "vue";

import type { DownloadSnapshotType } from "@/types/launcher/artifacts/download.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import {
  cleanupHarness, closeKey, documentState, type Element, instances, invoke, launchKey,
  launchStatus, mount, noop, overrideGlobals, startKey, state, translationsKey,
} from "./idle-ui-harness.ts";

afterEach(cleanupHarness);

beforeEach(() => {
  documentState.hidden = false;
  state.selected.currentInstance = "first";
});

test("color styles are isolated and apply positive blur only", async () => {
  const { useConfigColors } = await import("@/composables/use-config-colors.ts");
  const { styles } = useConfigColors();

  const other = useConfigColors().styles;
  const original = other.value.widget.background;

  styles.value.widget.background = "red";
  expect(other.value.widget.background).toBe(original);
  for (const blur of [null, 0, 8]) {
    state.ui.background.blur = state.ui.widget.blur = blur;
    expect(styles.value.overlay.backdropFilter).toBe(blur ? "blur(8px)" : undefined);
    expect(styles.value.widget.backdropFilter).toBe(blur ? "blur(8px)" : undefined);
  }
});

test("video follows initial and changed visibility until unmount", async () => {
  documentState.hidden = true;
  mock.module("@/components/general/base/Image.vue", () => ({ "default": {} }));
  const { "default": background } = await import(
    "@/components/general/layout/GlobalBackground.vue",
  );
  const add = spyOn(documentState, "addEventListener");
  const remove = spyOn(documentState, "removeEventListener");
  const view = mount<{ "video": Ref<Element> }>(background, "video");

  await nextTick();
  const video = view.bindings.video.value;

  expect(video.pause).toHaveBeenCalledTimes(1);
  documentState.hidden = false;
  documentState.dispatchEvent(new Event("visibilitychange"));
  expect(video.play).toHaveBeenCalledTimes(1);
  documentState.hidden = true;
  documentState.dispatchEvent(new Event("visibilitychange"));
  expect(video.pause).toHaveBeenCalledTimes(2);
  const listener = add.mock.calls.find(([name]) => name === "visibilitychange");

  expect(listener).toBeDefined();
  view.unmount();
  expect(remove).toHaveBeenCalledWith(...listener!);
  add.mockRestore();
  remove.mockRestore();
  documentState.hidden = false;
  documentState.dispatchEvent(new Event("visibilitychange"));
  expect(video.play).toHaveBeenCalledTimes(1);
});

test.each([0, 1, 2] as const)("launch state %i polls nonempty Maps", async launching => {
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const launches = reactive({ "first": launchStatus("first") });
  const status = launches.first;

  status.launching = launching;
  const interval = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  const view = mount<{ "currentDownloadSpeed": Ref<string>; "currentDownloadCount": Ref<number> }>(
    progress, "container", [[launchKey, launches], [translationsKey, {}]],
  );

  expect(interval).not.toHaveBeenCalled();

  for (const plain of [false, true]) {
    if (plain) {
      status.downloads.current = (new Map);
    }
    const current = status.downloads.current;
    const tuple: [number, number] = [0, 1_048_576];

    current.set("artifact", tuple);
    if (!plain) {
      expect(current.get("artifact")).toBe(tuple);
    }
    await nextTick();
    const index = plain ? 1 : 0;

    expect(interval).toHaveBeenCalledTimes(index + 1);
    expect(view.bindings.currentDownloadCount.value).toBe(1);
    expect(view.bindings.currentDownloadSpeed.value).toBe("1.00");
    const [tick, period] = interval.mock.calls[index];

    expect(period).toBe(100);
    tuple[1] *= 2;
    tick();
    expect(view.bindings.currentDownloadSpeed.value).toBe("2.00");
    if (plain) {
      current.clear();
    } else {
      current.delete("artifact");
    }
    await nextTick();
    expect(clear).toHaveBeenCalledWith(interval.mock.results[index].value);
    expect(view.bindings.currentDownloadCount.value).toBe(0);
    expect(view.bindings.currentDownloadSpeed.value).toBe("0.00");
  }
});

test("post-install artifacts poll at state 0 and clean only their own entries", async () => {
  const { concurrentlyDownload } = await import("@/lib/network/concurrently-download.ts");
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const launches = reactive({ "first": launchStatus("first") });
  const status = launches.first;
  const clear = spyOn(globalThis, "clearInterval");
  const view = mount<{ "currentDownloadSpeed": Ref<string> }>(
    progress, "container", [[launchKey, launches], [translationsKey, {}]],
  );

  status.launching = 0;

  status.downloads.current = (new Map);
  const original = status.downloads.current;
  let emit!: (snapshot: DownloadSnapshotType) => void;
  const report = Promise.withResolvers<object>();

  invoke.mockImplementationOnce(async (_, arguments_) => {
    emit = (arguments_ as { "onProgress": { "onmessage": typeof emit } }).onProgress.onmessage;

    return report.promise;
  });
  const batch = concurrentlyDownload({
    "statuses"   : status, "entries"    : ["a", "external"].map(path => ({ "url": path, path })),
    "label"      : "", "concurrency": 2,
  });
  const snapshot: DownloadSnapshotType = {
    "current": { "a": [1, 1_048_576], "external": [0, 0] }, "success": 0, "failed": 0,
  };

  emit(snapshot);
  await nextTick();
  expect(view.bindings.currentDownloadSpeed.value).toBe("1.00");
  expect(original.get("a")).toEqual([1, 1_048_576]);
  original.set("external", [7, 70]);
  status.downloads.current = new Map([["a", [7, 3_145_728]]]);
  report.resolve({ "cancelled": true, "success": 0, "failed": 0 });
  await batch;
  emit(snapshot);
  expect([...original.entries()]).toEqual([["external", [7, 70]]]);
  expect(status.downloads.current.get("a")).toEqual([7, 3_145_728]);
  state.selected.currentInstance = "second";
  await nextTick();
  expect(view.bindings.currentDownloadSpeed.value).toBe("0.00");
  expect(clear).toHaveBeenCalledTimes(1);
  state.selected.currentInstance = "first";
  await nextTick();
  expect(view.bindings.currentDownloadSpeed.value).toBe("3.00");
  view.unmount();
  expect(clear).toHaveBeenCalledTimes(2);
});

test("Home accrues only the selected instance's active gameplay time", async () => {
  mock.module("@/components/general/base/MaterialRipple.vue", () => ({ "default": {} }));
  mock.module("@/lib/launcher/scopes/fetching", () => ({ "default": {} }));
  mock.module("@/extendable/global-internals.ts", () => ({ "GlobalInternals": { "logs": {} } }));
  const { "default": launch } = await import("@/components/home/instance/Launch.vue");
  const launches = reactive<Record<string, LauncherStatusesType>>({});
  const interval = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  const now = spyOn(Date, "now").mockReturnValue(0);

  instances.first = { "playTime": 100 };
  instances.second = { "playTime": 10 };
  const view = mount(launch, "", [[launchKey, launches], [startKey, noop], [closeKey, noop]]);

  expect(interval).not.toHaveBeenCalled();
  launches.first = launchStatus("first");
  launches.second = launchStatus("second");
  now.mockReturnValue(5000);
  launches.first.launching = launches.second.launching = 2;
  await nextTick();
  expect(interval.mock.calls[0][1]).toBe(1000);
  now.mockReturnValue(6000);
  interval.mock.calls[0][0]();
  expect(instances.first.playTime).toBe(1100);
  now.mockReturnValue(6500);
  state.selected.currentInstance = "second";
  await nextTick();
  expect(instances.first.playTime).toBe(1600);
  expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
  now.mockReturnValue(7500);
  launches.second.launching = 0;
  await nextTick();
  expect(instances.second.playTime).toBe(1010);
  expect(clear).toHaveBeenCalledWith(interval.mock.results[1].value);
  view.unmount();
  now.mockRestore();
  interval.mockRestore();
  clear.mockRestore();
});

test("FPS uses a sliding second, publishes 15 bars and cancels its pending frame", async () => {
  const { "default": counter } = await import(
    "@/components/general/development-mode/FramesPerSecondCounter.vue",
  );
  let pending: FrameRequestCallback;
  let scheduled = 0;
  const cancel = mock(noop);

  overrideGlobals({
    "requestAnimationFrame": (frame: FrameRequestCallback): number => {
      pending = frame;

      return ++scheduled;
    },
    "cancelAnimationFrame": cancel,
  });
  type Readings = {
    "frames": Ref<Array<number>>;
    "limits": Ref<{ "current": number; "peak": string; "latency": string }>;
  };
  const interval = spyOn(globalThis, "setInterval");
  const view = mount<Readings>(counter, "");

  await nextTick();

  pending!(0);
  pending!(10);
  documentState.hidden = true;
  documentState.dispatchEvent(new Event("visibilitychange"));
  documentState.hidden = false;
  documentState.dispatchEvent(new Event("visibilitychange"));
  pending!(510);
  expect(view.bindings.limits.value.peak).toBe("16.7");
  for (let now = 520; now <= 2250; now += 5) {
    pending!(now);
  }
  expect(view.bindings.limits.value.current).toBe(200);
  expect(view.bindings.frames.value).toEqual(Array.from({ "length": 15 }, () => 200));
  const published = view.bindings.frames.value;

  pending!(2255);
  expect(view.bindings.frames.value).toBe(published);
  pending!(2272);
  pending!(3772);
  expect(view.bindings.frames.value).toEqual([1]);
  expect(view.bindings.limits.value.peak).toBe("1500.0");
  expect(view.bindings.limits.value.latency).toBe("1500.0");
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(scheduled);
  expect(interval).not.toHaveBeenCalled();
  interval.mockRestore();
});

test("the development overlay restores its dragged position on remount", async () => {
  for (const name of ["CpuUsage", "MemoryUsage"]) {
    mock.module(`@/components/general/development-mode/${name}.vue`, () => ({ "default": {} }));
  }
  const vueuse = await import("@vueuse/core");
  const draggable = spyOn(vueuse, "useDraggable");
  const { "default": overlay } = await import(
    "@/components/general/development-mode/DevelopmentMode.vue",
  );
  const first = mount(overlay, "container");
  const options = draggable.mock.calls[0][1]!;
  const dragged = { "x": 120, "y": 80 };

  options.onMove!(dragged, new Event("pointermove") as PointerEvent);
  first.unmount();
  const second = mount<{ "style": Ref<string> }>(overlay, "container");

  expect(second.bindings.style.value).toContain("left: 120px");
  expect(second.bindings.style.value).toContain("top: 80px");
  second.unmount();
  draggable.mockRestore();
});
