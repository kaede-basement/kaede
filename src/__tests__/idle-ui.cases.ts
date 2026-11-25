import { expect, mock, spyOn, test } from "bun:test";
import { markRaw, nextTick, reactive, type Ref } from "vue";

import { LaunchStatus } from "@/constants/launcher.ts";
import type { DownloadSnapshotType } from "@/types/launcher/artifacts/download.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import {
  documentState, type Element, invoke, launchKey, mount, noop, state, translationsKey,
} from "./idle-ui-harness.ts";

test("window shares color styles and applies positive blur only", async () => {
  const { useConfigColors } = await import("@/composables/use-config-colors.ts");
  const { styles } = useConfigColors();

  expect(useConfigColors().styles).toBe(styles);
  for (const blur of [null, 0, 8]) {
    state.ui.background.blur = state.ui.widget.blur = blur;
    expect(styles.value.overlay.backdropFilter).toBe(blur ? "blur(8px)" : undefined);
    expect(styles.value.widget.backdropFilter).toBe(blur ? "blur(8px)" : undefined);
  }
});

test("video follows initial and changed visibility until unmount", async () => {
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

test.each(["observable", "plain"])("launch progress tracks %s Maps without polling", async kind => {
  const { ObservableDownloadMap } = await import("@/lib/network/download-progress.ts");
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const { concurrentlyDownload } = await import("@/lib/network/concurrently-download.ts");
  const { isClient } = await import("@vueuse/core");

  expect(isClient).toBe(true);
  const launches = reactive<Record<string, LauncherStatusesType>>({});
  const interval = spyOn(globalThis, "setInterval");
  const view = mount<{
    "currentDownloads": Ref<{ "speed": string; "count": number }>;
    "progress"        : Ref<number>;
  }>(
    progress, "container", [[launchKey, launches], [translationsKey, {}]],
  );

  expect(view.bindings.progress.value).toBe(0);
  expect(interval).not.toHaveBeenCalled();
  const current = kind === "observable"
    ? new ObservableDownloadMap
    : new Map<string, [number, number]>;

  launches.first = {
    "instanceId": "first", "launching" : 1, "current"   : LaunchStatus.General.Starting,
    "downloads" : { "current": markRaw(current), "success": 0, "failed": 0, "total": 0 },
  };
  expect(view.bindings.progress.value).toBe(10);
  expect(view.bindings.currentDownloads.value.speed).toBe("0.00");
  const map = launches.first.downloads.current;

  if (kind === "observable") {
    map.set("hook", [1, 1_048_576]);
    expect(view.bindings.currentDownloads.value).toEqual({ "speed": "1.00", "count": 1 });
    map.delete("hook");
    expect(view.bindings.currentDownloads.value.count).toBe(0);
    map.set("hook", [2, 2_097_152]);
    expect(view.bindings.currentDownloads.value.speed).toBe("2.00");
    map.clear();
    expect(view.bindings.currentDownloads.value.count).toBe(0);
  }

  type Channel = { "onmessage": (snapshot: DownloadSnapshotType) => void };
  const channels: Array<Channel> = [];
  const reports = [Promise.withResolvers<object>(), Promise.withResolvers<object>()];

  invoke.mockImplementation(async (_, arguments_) => {
    const batch = channels.length;

    channels.push((arguments_ as { "onProgress": Channel }).onProgress);

    return reports[batch].promise;
  });
  const batches = [["a", "b"], ["b"]].map(paths => concurrentlyDownload({
    "statuses"   : launches.first, "concurrency": 2,
    "entries"    : paths.map(path => ({ "url": path, path })), "label"      : paths.join(","),
  }));
  const first: DownloadSnapshotType = {
    "current": { "a": [1, 1_048_576] }, "success": 0, "failed": 0,
  };

  channels[0].onmessage(first);
  channels[1].onmessage({ ...first, "current": { "b": [2, 2_097_152] } });
  const overlap: DownloadSnapshotType = {
    ...first, "current": { ...first.current, "b": [3, 4_194_304] },
  };

  channels[0].onmessage(overlap);
  channels[0].onmessage(first);
  expect(view.bindings.currentDownloads.value).toEqual({ "speed": "3.00", "count": 2 });
  channels[0].onmessage(overlap);
  expect(map).toBe(launches.first.downloads.current);
  expect(view.bindings.currentDownloads.value).toEqual({ "speed": "5.00", "count": 2 });
  state.selected.currentInstance = "second";
  expect(view.bindings.currentDownloads.value.speed).toBe("0.00");
  state.selected.currentInstance = "first";
  reports[0].resolve({ "cancelled": true, "success": 0, "failed": 0 });
  await batches[0];
  channels[0].onmessage({ ...first, "success": 1 });
  expect(launches.first.downloads.success).toBe(0);
  expect([...map.keys()]).toEqual(["b"]);
  expect(view.bindings.currentDownloads.value).toEqual({ "speed": "2.00", "count": 1 });
  reports[1].resolve({ "cancelled": false, "success": 1, "failed": 0 });
  await batches[1];
  expect(map.size).toBe(0);
  expect(view.bindings.currentDownloads.value.speed).toBe("0.00");
  launches.first.current = LaunchStatus.General.Success;
  expect(view.bindings.progress.value).toBe(100);
  expect(interval).not.toHaveBeenCalled();
  interval.mockRestore();
  view.unmount();
});

test("FPS uses a sliding second, publishes 15 bars and cancels its pending frame", async () => {
  const { "default": counter } = await import(
    "@/components/general/development-mode/FramesPerSecondCounter.vue",
  );
  let pending: FrameRequestCallback;
  let scheduled = 0;
  const cancel = mock(noop);

  Object.assign(globalThis, {
    "requestAnimationFrame": (frame: FrameRequestCallback): number => {
      pending = frame;

      return ++scheduled;
    },
    "cancelAnimationFrame": cancel,
  });
  type Readings = {
    "frames": Ref<Array<number>>;
    "limits": Ref<{ "current": number; "peak": string }>;
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
  pending!(12_272);
  expect(view.bindings.frames.value).toEqual([1]);
  for (let now = 12_282; now < 12_500; now += 10) {
    pending!(now);
  }
  expect(view.bindings.limits.value.peak).toBe("17.0");
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(scheduled);
  expect(interval).not.toHaveBeenCalled();
  interval.mockRestore();
});

test("the development overlay restores its dragged position on remount", async () => {
  for (const name of ["CpuUsage", "FramesPerSecondCounter", "MemoryUsage"]) {
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
