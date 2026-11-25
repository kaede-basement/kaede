import { afterEach, expect, mock, test } from "bun:test";
import { nextTick, reactive } from "vue";

import {
  asyncNoop, authKey,   cleanupHarness, mount, type Mounted, noop, overrideGlobals,
  translationsKey,
} from "./idle-ui-harness.ts";

afterEach(cleanupHarness);

test("profile draws on demand and releases viewers created before or after teardown", async () => {
  const frames = (new Map<number, FrameRequestCallback>);
  let id = 0;
  const observe = mock(noop);
  let resized!: (entries: Array<{ "contentRect": { "width": number; "height": number } }>) => void;

  overrideGlobals({
    "devicePixelRatio"     : 2,
    "requestAnimationFrame": (callback: FrameRequestCallback): number => {
      frames.set(++id, callback);

      return id;
    },
    "cancelAnimationFrame": (handle: number): boolean => frames.delete(handle),
    "ResizeObserver"      : class {
      constructor(callback: typeof resized) {
        resized = callback;
      }

      observe = observe;
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
  const zoomChange = mock(noop);
  const rotationChange = mock(noop);
  const gpu = {
    "setRotation"     : mock(noop), "resetCamera"     : mock(noop), "setZoom"         : mock(noop),
    render, "resize"          : mock(noop),
    "startRenderLoop" : startLoop, "stopRenderLoop"  : stopLoop,
    "setSkin"         : mock(asyncNoop), "setSlim"         : mock(noop),
    dispose,
    "playAnimation"   : mock(noop), "stopAnimation"   : mock(noop),
    "onZoomChange"    : zoomChange, "onRotationChange": rotationChange,
  };
  let canvas!: HTMLCanvasElement;
  const create = mock(async (options: { "canvas": HTMLCanvasElement }) => {
    canvas = options.canvas;

    return gpu;
  });

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
      profile, "canvas", [[authKey, accounts], [translationsKey, {}]], "viewport",
    );
  }
  const view = mountProfile();

  await Bun.sleep(0);
  expect(gpu.setSkin).toHaveBeenCalledWith("skin1");
  drawFrame();
  expect(gpu.render).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);

  const texture = Promise.withResolvers<void>();

  gpu.setSkin.mockImplementationOnce(() => texture.promise);
  accounts.value[0].skin.url = "new-classic";
  await nextTick();
  expect(gpu.setSkin).toHaveBeenLastCalledWith("new-classic");
  expect(frames.size).toBe(0);
  texture.resolve();
  await Bun.sleep(0);
  expect(frames.size).toBe(1);
  drawFrame();
  expect(render).toHaveBeenCalledTimes(2);

  expect(observe).toHaveBeenCalledWith(canvas.parentElement?.parentElement);
  expect(observe).not.toHaveBeenCalledWith(canvas);
  expect(startLoop).not.toHaveBeenCalled();
  gpu.render.mockClear();
  for (const update of [gpu.setRotation, gpu.setZoom, gpu.resetCamera]) {
    update();
    expect(frames.size).toBe(1);
    drawFrame();
  }
  expect(render).toHaveBeenCalledTimes(3);
  render.mockClear();
  gpu.onRotationChange();
  gpu.onZoomChange();
  expect(rotationChange).toHaveBeenCalled();
  expect(zoomChange).toHaveBeenCalled();
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
  expect(frames.size).toBe(1);
  drawFrame();
  expect(gpu.render).toHaveBeenCalledTimes(3);
  gpu.onZoomChange();
  view.bindings.startWalk();
  accounts.value[0].skin = { "variant": "classic", "url": "skin3" };
  await Bun.sleep(0);
  expect(gpu.setSkin).toHaveBeenLastCalledWith("skin3");
  expect(gpu.setSlim).toHaveBeenLastCalledWith(false);
  expect(render).toHaveBeenCalledTimes(3);
  gpu.onRotationChange();
  gpu.onZoomChange();
  expect(frames.size).toBe(1);
  drawFrame();
  expect(render).toHaveBeenCalledTimes(4);
  expect(startLoop).toHaveBeenCalledTimes(1);
  expect(gpu.playAnimation).toHaveBeenCalledWith("walk");
  view.bindings.stopWalk();
  expect(stopLoop).toHaveBeenCalledTimes(1);
  expect(gpu.render).toHaveBeenCalledTimes(5);
  gpu.onZoomChange();
  view.unmount();
  expect(frames.size).toBe(0);
  expect(dispose).toHaveBeenCalledTimes(1);
  const pending = Promise.withResolvers<typeof gpu>();

  create.mockImplementationOnce(() => pending.promise);
  const late = mountProfile();

  await Bun.sleep(0);
  expect(create).toHaveBeenCalledTimes(2);
  late.unmount();
  pending.resolve(gpu);
  await nextTick();
  expect(dispose).toHaveBeenCalledTimes(2);
  expect(startLoop).toHaveBeenCalledTimes(1);
  const loading = mountProfile();

  await nextTick();
  loading.unmount();
  await Bun.sleep(0);
  expect(create).toHaveBeenCalledTimes(2);
});

test("extension canvases preserve the native loop, callbacks and DPR sizing", async () => {
  let rotation = 0;
  let paintedRotation = 0;
  const observer = mock(noop);
  const onRotationChange = mock(noop);
  let paint!: () => void;
  const gpu = {
    onRotationChange,
    "setRotation": (angle: number): void => {
      rotation = angle;
    },
    "startRenderLoop": mock(() => {
      paint = (): void => {
        paintedRotation = rotation;
      };
    }),
    "resize": mock(noop), "setSlim": noop, "dispose": mock(noop),
  };

  overrideGlobals({ "devicePixelRatio": 2, "ResizeObserver"  : class {
    constructor() {
      observer();
    }
  } });
  const create = mock(async ({ canvas }: { "canvas": HTMLCanvasElement }) => {
    canvas.width = 150 * devicePixelRatio;
    canvas.height = 225 * devicePixelRatio;

    return gpu;
  });

  mock.module("@daidr/minecraft-skin-renderer/webgl", () => ({ "WebGLRendererPlugin": {} }));
  mock.module("@daidr/minecraft-skin-renderer", () => ({
    "createSkinViewer": create, "use": noop,
  }));
  const { useSkinRenderer } = await import("@/composables/use-skin-renderer.ts");
  const component = {
    "setup": (): ReturnType<typeof useSkinRenderer> => useSkinRenderer({ "render": "3d" }),
  };
  const view = mount<ReturnType<typeof useSkinRenderer>>(component, "canvas", [[authKey, {}]]);

  await Bun.sleep(0);
  expect(Object.is(view.bindings.viewer.value, gpu)).toBe(true);
  expect(gpu.startRenderLoop).toHaveBeenCalledTimes(1);
  expect(gpu.onRotationChange).toBe(onRotationChange);
  view.bindings.viewer.value!.setRotation(42, 0);
  paint();
  expect(paintedRotation).toBe(42);
  expect(observer).not.toHaveBeenCalled();
  expect(gpu.resize).not.toHaveBeenCalled();
  expect(view.bindings.canvas.value?.width).toBe(300);
  view.unmount();
  expect(gpu.dispose).toHaveBeenCalledTimes(1);
});
