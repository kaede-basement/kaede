/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { SkinViewer } from "@daidr/minecraft-skin-renderer";
import {
  computed, type ComputedRef, inject, onScopeDispose,
  type Ref,
  ref, type ShallowRef, shallowRef,
  type TemplateRef, useTemplateRef,
  watch,
} from "vue";

import { AuthStatesContextKey } from "@/constants/application.ts";
import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
// The Steve that is shown when there are no accounts or the selected account has no skins
import FallbackSteve from "@/resources/steve_classic.png";
import { globalStates } from "@/states/global.ts";
import type { AccountType, WrappedAccountsType } from "@/types/configs/account.type.ts";

function configureDemandRendering(viewer: SkinViewer, resizeTarget: HTMLElement): () => void {
  let loopRunning = false;
  let disposed = false;
  let frame: number | undefined;

  function cancelFrame(): void {
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
      frame = undefined;
    }
  }

  function scheduleRender(): void {
    if (disposed || loopRunning || frame !== undefined) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = undefined;
      viewer.render();
    });
  }

  const { onZoomChange, onRotationChange } = viewer;

  viewer.onZoomChange = (zoom): void => {
    scheduleRender();
    onZoomChange?.(zoom);
  };
  viewer.onRotationChange = (theta, phi): void => {
    scheduleRender();
    onRotationChange?.(theta, phi);
  };
  const observer = new ResizeObserver(([{ "contentRect": { width, height } }]) => {
    if (!disposed && width > 0 && height > 0) {
      viewer.resize(width, height);
      scheduleRender();
    }
  });

  // The layout box is independent of the DPR-scaled drawing buffer.
  observer.observe(resizeTarget);

  const { setRotation, setZoom, resetCamera } = viewer;

  viewer.setRotation = (theta, phi): void => {
    setRotation(theta, phi);
    scheduleRender();
  };
  viewer.setZoom = (zoom): void => {
    setZoom(zoom);
    scheduleRender();
  };
  viewer.resetCamera = (): void => {
    resetCamera();
    scheduleRender();
  };

  const { startRenderLoop, stopRenderLoop, dispose } = viewer;

  viewer.startRenderLoop = (): void => {
    cancelFrame();
    loopRunning = true;
    startRenderLoop();
  };
  viewer.stopRenderLoop = (): void => {
    stopRenderLoop();
    loopRunning = false;
  };
  viewer.dispose = (): void => {
    disposed = true;
    cancelFrame();
    observer.disconnect();
    dispose();
  };

  return scheduleRender;
}

type RendererState = {
  "canvas": TemplateRef<HTMLCanvasElement>;
  "shown" : Ref<boolean>;
  "viewer": ShallowRef<SkinViewer | undefined>;
};

export function useSkinRenderer({
  render,
  account,
}: {
  "render"  : "3d" | "2d-head";
  "account"?: ComputedRef<AccountType | undefined>;
}): RendererState {
  return useRenderer(render, account);
}

export function useProfileSkinRenderer(resizeTarget: TemplateRef<HTMLElement>): RendererState {
  return useRenderer("3d", undefined, resizeTarget);
}

function useRenderer(
  render: "3d" | "2d-head", account?: ComputedRef<AccountType | undefined>,
  resizeTarget?: TemplateRef<HTMLElement>,
): RendererState {
  const accounts = inject<WrappedAccountsType>(AuthStatesContextKey);

  const selected = computed(() => (
    account?.value ?? accounts?.value?.[globalStates.selected.account]
  ));
  const source = computed(() => {
    const skin = selected.value?.skin;

    return skin?.data ? `data:image/png;base64,${skin.data}` : skin?.url || FallbackSteve;
  });
  const slim = computed(() => selected.value?.skin.variant === "slim");

  const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
  const shown = ref<boolean>(false);
  const viewer = shallowRef<SkinViewer | undefined>();

  let generation = 0;

  function report(error: unknown): void {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `Error rendering the '${render}' skin:`,
      Errors.prettify(error),
    );
  }

  if (render === "2d-head") {
    let clearCanvas: (() => void) | undefined;

    watch(canvas, () => {
      clearCanvas?.();
      clearCanvas = undefined;
    }, { "flush": "sync" });
    onScopeDispose(() => clearCanvas?.());
    watch([canvas, source], ([target, skin], _, onCleanup) => {
      if (!target) return;
      if (target.width !== 32) target.width = 32;
      if (target.height !== 32) target.height = 32;
      const context = target.getContext("2d");

      if (!context) {
        report(new Error("Unable to draw the avatar"));

        return;
      }
      clearCanvas = (): void => {
        context.clearRect(0, 0, 32, 32);
        shown.value = false;
      };
      context.imageSmoothingEnabled = false;
      const image = (new Image);
      const draw = (): void => {
        const size = image.naturalWidth / 8;

        context.clearRect(0, 0, 32, 32);
        context.drawImage(image, size, size, size, size, 0, 0, 32, 32);
        context.drawImage(image, 5 * size, size, size, size, 0, 0, 32, 32);
        shown.value = true;
      };
      const failed = (): void => {
        context.clearRect(0, 0, 32, 32);
        shown.value = false;
        report(new Error("Unable to load the avatar skin"));
      };

      image.addEventListener("load", draw);
      image.addEventListener("error", failed);
      onCleanup(() => {
        image.removeEventListener("load", draw);
        image.removeEventListener("error", failed);
        image.removeAttribute("src");
      });
      if (!skin.startsWith("data:")) image.crossOrigin = "anonymous";
      image.src = skin;
    }, { "flush": "post" });
  } else {
    let requestRender: (() => void) | undefined;

    const viewportElement = computed(() => resizeTarget?.value);

    watch([canvas, viewportElement], async ([target, viewport], _, onCleanup) => {
      if (!target || (resizeTarget && !viewport)) {
        return;
      }

      let closed = false;

      onCleanup(() => {
        closed = true;
        requestRender = undefined;
        viewer.value?.dispose();
        viewer.value = undefined;
        shown.value = false;
      });

      try {
        // Initialize with the local placeholder so teardown never waits for a remote skin.
        const { createSkinViewer } = await import("./skin-viewer.ts");

        if (closed) return;
        const created = await createSkinViewer({
          "canvas": target, "skin": FallbackSteve, "zoom": 35,
        });

        if (closed) {
          created.dispose();
        } else {
          viewer.value = created;
          if (viewport) {
            requestRender = configureDemandRendering(created, viewport);
          } else {
            created.startRenderLoop();
          }
          shown.value = true;
        }
      } catch (error) {
        if (!closed) {
          report(error);
        }
      }
    }, { "flush": "post" });

    watch([viewer, slim], ([current, isSlim]) => {
      current?.setSlim(isSlim);
      requestRender?.();
    });
    watch([viewer, source], async ([current, skin], [previous], onCleanup) => {
      const request = ++generation;

      onCleanup(() => {
        generation++;
      });

      if (!current || (current !== previous && skin === FallbackSteve)) {
        return;
      }

      try {
        await current.setSkin(skin);
        if (generation === request) {
          requestRender?.();
        }
      } catch (error) {
        if (generation === request) {
          report(error);
        }
      }
    });
  }

  return { canvas, shown, viewer };
}