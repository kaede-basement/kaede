import { expect, mock, test } from "bun:test";
import { nextTick, reactive } from "vue";

import {
  asyncNoop, authKey, mount, type Mounted, noop, translationsKey,
} from "./idle-ui-harness.ts";

test("profile draws on demand and releases viewers created before or after teardown", async () => {
  const frames = (new Map<number, FrameRequestCallback>);
  let id = 0;
  let resized!: (entries: Array<{ "contentRect": { "width": number; "height": number } }>) => void;

  Object.assign(globalThis, {
    "requestAnimationFrame": (callback: FrameRequestCallback): number => {
      frames.set(++id, callback);

      return id;
    },
    "cancelAnimationFrame": (handle: number): boolean => frames.delete(handle),
    "ResizeObserver"      : class {
      constructor(callback: typeof resized) {
        resized = callback;
      }

      observe(): void {}
      disconnect(): void {}
    },
  });
  function drawFrame(): void {
    const callbacks = [...frames.values()];

    frames.clear();
    for (const callback of callbacks) {
      callback(0);
    }
  }
  const render = mock(noop);
  const startLoop = mock(() => requestAnimationFrame(render));
  const stopLoop = mock(noop);
  const dispose = mock(noop);
  const gpu = {
    render, "resize"          : mock(noop),
    "startRenderLoop" : startLoop, "stopRenderLoop"  : stopLoop,
    "setSkin"         : mock(asyncNoop), "setSlim"         : mock(noop),
    dispose,
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
  expect(startLoop).not.toHaveBeenCalled();
  gpu.render.mockClear();
  gpu.onRotationChange();
  gpu.onZoomChange();
  expect(frames.size).toBe(1);
  drawFrame();
  expect(render).toHaveBeenCalledTimes(1);
  resized([{ "contentRect": { "width": 200, "height": 300 } }]);
  expect(gpu.resize).toHaveBeenCalledWith(200, 300);
  drawFrame();
  expect(render).toHaveBeenCalledTimes(2);
  accounts.value[0].skin = { "variant": "slim", "url": "skin2" };
  await Bun.sleep(0);
  expect(gpu.setSlim).toHaveBeenLastCalledWith(true);
  expect(gpu.setSkin).toHaveBeenLastCalledWith("skin2");
  expect(gpu.render).toHaveBeenCalledTimes(4);
  gpu.onZoomChange();
  view.bindings.startWalk();
  gpu.onRotationChange();
  gpu.onZoomChange();
  expect(frames.size).toBe(1);
  drawFrame();
  expect(render).toHaveBeenCalledTimes(5);
  expect(startLoop).toHaveBeenCalledTimes(1);
  expect(gpu.playAnimation).toHaveBeenCalledWith("walk");
  view.bindings.stopWalk();
  expect(stopLoop).toHaveBeenCalledTimes(1);
  expect(gpu.render).toHaveBeenCalledTimes(6);
  gpu.onZoomChange();
  view.unmount();
  expect(frames.size).toBe(0);
  expect(dispose).toHaveBeenCalledTimes(1);
  const pending = Promise.withResolvers<typeof gpu>();

  create.mockImplementationOnce(() => pending.promise);
  const late = mountProfile();

  await nextTick();
  late.unmount();
  pending.resolve(gpu);
  await nextTick();
  expect(dispose).toHaveBeenCalledTimes(2);
  expect(startLoop).toHaveBeenCalledTimes(1);
});
