import { expect, mock, spyOn, test } from "bun:test";
import { markRaw, nextTick, reactive, type Ref } from "vue";

import { LaunchStatus } from "@/constants/launcher.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

import { asyncNoop,
  authKey, documentState,   type Element, invoke, launchKey, mount, type Mounted,
  noop, state, translationsKey } from "./idle-ui-harness.ts";

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
  view.unmount();
  documentState.hidden = false;
  documentState.dispatchEvent(new Event("visibilitychange"));
  expect(video.play).toHaveBeenCalledTimes(1);
});

test("launch progress consumes download snapshots without polling", async () => {
  const { "default": progress } = await import("@/components/general/layout/LaunchProgress.vue");
  const { concurrentlyDownload } = await import("@/lib/network/concurrently-download.ts");
  const launches = reactive<Record<string, LauncherStatusesType>>({});
  const interval = spyOn(globalThis, "setInterval");
  const view = mount<{ "currentDownloadSpeed": Ref<string>; "progress": Ref<number> }>(
    progress, "container", [[launchKey, launches], [translationsKey, {}]],
  );

  expect(view.bindings.progress.value).toBe(0);
  expect(interval).not.toHaveBeenCalled();
  launches.first = {
    "instanceId": "first", "launching" : 1, "current"   : LaunchStatus.General.Starting,
    "downloads" : { "current": markRaw((new Map)), "success": 0, "failed": 0, "total": 0 },
  };
  expect(view.bindings.progress.value).toBe(10);
  expect(view.bindings.currentDownloadSpeed.value).toBe("0.00");
  const snapshot = { "current": { "a": [1, 1_048_576] }, "success": 0, "failed": 0 };

  invoke.mockImplementationOnce(async (_, arguments_) => {
    const { onProgress } = arguments_ as {
      "onProgress": { "onmessage": (data: typeof snapshot) => void };
    };

    onProgress.onmessage(snapshot);
    expect(view.bindings.currentDownloadSpeed.value).toBe("1.00");
    snapshot.current.a = [2, 2_097_152];
    onProgress.onmessage(snapshot);
    expect(view.bindings.currentDownloadSpeed.value).toBe("2.00");
    state.selected.currentInstance = "second";
    expect(view.bindings.currentDownloadSpeed.value).toBe("0.00");
    state.selected.currentInstance = "first";

    return { "cancelled": true, "success": 0, "failed": 0 };
  });
  await concurrentlyDownload({
    "statuses"   : launches.first, "concurrency": 1,
    "entries"    : [{ "url": "", "path": "a" }], "label"      : "",
  });
  expect(view.bindings.currentDownloadSpeed.value).toBe("0.00");
  launches.first.current = LaunchStatus.General.Success;
  expect(view.bindings.progress.value).toBe(100);
  expect(interval).not.toHaveBeenCalled();
  interval.mockRestore();
  view.unmount();
});

test("profile draws on demand and releases viewers created before or after teardown", async () => {
  const gpu = {
    "render"          : mock(noop),
    "startRenderLoop" : mock(noop), "stopRenderLoop"  : mock(noop),
    "setSkin"         : mock(asyncNoop), "setSlim"         : mock(noop),
    "dispose"         : mock(noop),
    "playAnimation"   : mock(noop), "stopAnimation"   : mock(noop),
    "onZoomChange"    : noop, "onRotationChange": noop,
  };
  const create = mock(async () => gpu);

  mock.module("@daidr/minecraft-skin-renderer/webgl", () => ({ "WebGLRendererPlugin": {} }));
  mock.module("@daidr/minecraft-skin-renderer", () => ({
    "createSkinViewer": create, "use": noop,
  }));
  for (const path of [
    "@/components/profile/AccountRow.vue",
    "@/components/profile/Logins/Microsoft.vue",
    "@/components/profile/Logins/Offline.vue",
    "@/components/profile/LoginStatus.vue",
    "@/extendable/component-registry.ts",
  ]) {
    mock.module(path, () => ({ "default": {}, "C": {} }));
  }
  const { "default": profile } = await import("@/components/profile/Profile.vue");
  const accounts = reactive({ "value": [{ "skin": { "variant": "classic", "url": "skin1" } }] });

  function mountProfile(): Mounted<{ startWalk(): void; stopWalk(): void }> {
    return mount<{ startWalk(): void; stopWalk(): void }>(
      profile, "canvas", [[authKey, accounts], [translationsKey, {}]],
    );
  }
  const view = mountProfile();

  await Bun.sleep(0);
  expect(gpu.setSkin).toHaveBeenCalledWith("skin1");
  expect(gpu.render).toHaveBeenCalled();
  expect(gpu.startRenderLoop).not.toHaveBeenCalled();
  gpu.render.mockClear();
  gpu.onRotationChange();
  gpu.onZoomChange();
  expect(gpu.render).toHaveBeenCalledTimes(2);
  accounts.value[0].skin = { "variant": "slim", "url": "skin2" };
  await Bun.sleep(0);
  expect(gpu.setSlim).toHaveBeenLastCalledWith(true);
  expect(gpu.setSkin).toHaveBeenLastCalledWith("skin2");
  expect(gpu.render).toHaveBeenCalledTimes(4);
  view.bindings.startWalk();
  expect(gpu.startRenderLoop).toHaveBeenCalledTimes(1);
  expect(gpu.playAnimation).toHaveBeenCalledWith("walk");
  view.bindings.stopWalk();
  expect(gpu.stopRenderLoop).toHaveBeenCalledTimes(1);
  expect(gpu.render).toHaveBeenCalledTimes(5);
  view.unmount();
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
  const pending = Promise.withResolvers<typeof gpu>();

  create.mockImplementationOnce(() => pending.promise);
  const late = mountProfile();

  await nextTick();
  late.unmount();
  pending.resolve(gpu);
  await nextTick();
  expect(gpu.dispose).toHaveBeenCalledTimes(2);
  expect(gpu.startRenderLoop).toHaveBeenCalledTimes(1);
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
  type Readings = { "frames": Ref<Array<number>>; "limits": Ref<{ "current": number }> };
  const view = mount<Readings>(counter, "");

  for (let now = 0; now <= 1250; now += 5) {
    pending!(now);
  }
  expect(view.bindings.limits.value.current).toBe(200);
  expect(view.bindings.frames.value).toEqual(Array.from({ "length": 15 }, () => 200));
  const published = view.bindings.frames.value;

  pending!(1255);
  expect(view.bindings.frames.value).toBe(published);
  pending!(3000);
  expect(view.bindings.frames.value).toEqual([1]);
  view.unmount();
  expect(cancel).toHaveBeenCalledWith(scheduled);
});
