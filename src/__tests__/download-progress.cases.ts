import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { markRaw, nextTick, reactive, type Ref } from "vue";

import type { DownloadSnapshotType } from "@/types/launcher/artifacts/download.type.ts";

import {
  cleanupHarness, invoke, launchKey, launchStatus, mount, state, translationsKey,
} from "./idle-ui-harness.ts";

type Progress = { "currentDownloadCount": Ref<number>; "currentDownloadSpeed": Ref<string> };

afterEach(cleanupHarness);
beforeEach(() => {
  state.selected.currentInstance = "first";
});

test.each([0, 1, 2] as const)("launch state %i polls nonempty Maps", async launching => {
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const launches = reactive({ "first": launchStatus("first") });
  const status = launches.first;

  status.launching = launching;
  const interval = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  const view = mount<Progress>(
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
  const foreign = status.downloads.current.get("a");

  emit({ ...snapshot, "current": { "a": [2, 12] } });
  expect(original.has("a")).toBe(false);
  expect(status.downloads.current.get("a")).toBe(foreign);
  report.resolve({ "cancelled": true, "success": 0, "failed": 0 });
  await batch;
  emit(snapshot);
  expect([...original.entries()]).toEqual([["external", [7, 70]]]);
  expect(status.downloads.current.get("a")).toBe(foreign);
});

test("a selected legacy raw Map polls until an empty reactive Map replaces it", async () => {
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const launches = reactive({ "first": launchStatus("first"), "second": launchStatus("second") });
  const legacy = markRaw(new Map<string, [number, number]>);

  launches.first.downloads.current = legacy;
  const interval = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  const { bindings } = mount<Progress>(
    progress, "container", [[launchKey, launches], [translationsKey, {}]],
  );
  const [tick] = interval.mock.calls[0];

  legacy.set("first", [0, 1_048_576]);
  tick();
  expect(bindings.currentDownloadSpeed.value).toBe("1.00");
  expect(bindings.currentDownloadCount.value).toBe(1);
  legacy.clear();
  tick();
  expect(bindings.currentDownloadSpeed.value).toBe("0.00");
  expect(bindings.currentDownloadCount.value).toBe(0);

  legacy.set("first", [0, 1_048_576]);
  tick();
  const second = launches.second.downloads.current;

  second.set("foo", [0, 1_048_576]);
  second.set("bar", [0, 2_097_152]);
  state.selected.currentInstance = "second";
  await nextTick();
  expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
  expect(bindings.currentDownloadCount.value).toBe(2);
  expect(bindings.currentDownloadSpeed.value).toBe("3.00");
  state.selected.currentInstance = "first";
  await nextTick();
  expect(bindings.currentDownloadCount.value).toBe(1);
  launches.first.downloads.current = (new Map);
  await nextTick();
  expect(bindings.currentDownloadCount.value).toBe(0);
  expect(bindings.currentDownloadSpeed.value).toBe("0.00");
  expect(clear).toHaveBeenCalledWith(interval.mock.results[2].value);
  expect(interval).toHaveBeenCalledTimes(3);
});
