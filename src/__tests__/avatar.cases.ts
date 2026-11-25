import { afterEach, expect, mock, test } from "bun:test";
import { nextTick, reactive } from "vue";

import { authKey, cleanupHarness, mount, noop, overrideGlobals } from "./idle-ui-harness.ts";

afterEach(cleanupHarness);

test("heads draw both scaled layers and discard superseded or unmounted loads", async () => {
  const images: Array<SkinImage> = [];

  class SkinImage extends EventTarget {
    naturalWidth = 64;
    naturalHeight = 64;
    src = "";
    removeAttribute = mock(noop);
    constructor() {
      super();
      images.push(this);
    }
  }
  const context = {
    "imageSmoothingEnabled": true,
    "drawImage"            : mock((...arguments_: Array<unknown>) => arguments_),
    "clearRect"            : mock(noop),
  };
  const prototype = globalThis.Element.prototype;
  const getContext = mock((type: string) => type === "2d" && context);

  Object.defineProperty(prototype, "getContext", { "configurable": true, "value": getContext });
  overrideGlobals({ "Image": SkinImage });
  try {
    const { useSkinRenderer } = await import("@/composables/use-skin-renderer.ts");
    const accounts = reactive({ "value": [{ "skin": { "url": "initial" } }] });
    const component = {
      "setup": (): ReturnType<typeof useSkinRenderer> => useSkinRenderer({ "render": "2d-head" }),
    };
    const view = mount<ReturnType<typeof useSkinRenderer>>(
      component, "canvas", [[authKey, accounts]],
    );

    await nextTick();
    for (const [width, height] of [[64, 32], [64, 64], [128, 128], [256, 256]]) {
      const stale = images[images.length - 1];

      accounts.value[0].skin.url = String(width) + "/" + height;
      await nextTick();
      expect(stale.removeAttribute).toHaveBeenCalledWith("src");
      stale.dispatchEvent(new Event("load"));
      expect(context.drawImage).not.toHaveBeenCalled();
      const image = images[images.length - 1];
      const size = width / 8;

      image.naturalWidth = width;
      image.naturalHeight = height;
      image.dispatchEvent(new Event("load"));
      expect(context.imageSmoothingEnabled).toBe(false);
      expect(context.drawImage.mock.calls).toEqual([
        [image, size, size, size, size, 0, 0, 32, 32],
        [image, 5 * size, size, size, size, 0, 0, 32, 32],
      ]);
      expect(view.bindings.shown.value).toBe(true);
      context.drawImage.mockClear();
    }
    const latest = images[images.length - 1];

    latest.dispatchEvent(new Event("error"));
    expect(view.bindings.shown.value).toBe(false);
    expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 32, 32);
    view.unmount();
    latest.dispatchEvent(new Event("load"));
    expect(context.drawImage).not.toHaveBeenCalled();
    expect(getContext.mock.calls.every(([type]) => type === "2d")).toBe(true);
  } finally {
    Reflect.deleteProperty(prototype, "getContext");
  }
});
