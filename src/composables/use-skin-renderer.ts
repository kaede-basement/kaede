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

import { createSkinViewer, type SkinViewer, use } from "@daidr/minecraft-skin-renderer";
import { renderAvatar } from "@daidr/minecraft-skin-renderer/canvas2d";
import { WebGLRendererPlugin } from "@daidr/minecraft-skin-renderer/webgl";
import {
  computed, type ComputedRef, inject,
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

use(WebGLRendererPlugin);

function configureDemandRendering(viewer: SkinViewer, canvas: HTMLCanvasElement): void {
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

  viewer.onZoomChange = scheduleRender;
  viewer.onRotationChange = scheduleRender;
  const observer = new ResizeObserver(([{ "contentRect": { width, height } }]) => {
    if (!disposed && width > 0 && height > 0) {
      viewer.resize(width, height);
      scheduleRender();
    }
  });

  observer.observe(canvas);

  // Extensions can also control the viewer's loop and lifetime directly.
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
}

export function useSkinRenderer({
  render,
  account,
}: {
  "render"  : "3d" | "2d-head";
  "account"?: ComputedRef<AccountType | undefined>;
}): {
  "canvas": TemplateRef<HTMLCanvasElement>;
  "shown" : Ref<boolean>;
  // 'viewer' is undefined for '2d-head'
  "viewer": ShallowRef<SkinViewer | undefined>;
} {
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
    watch([canvas, source], async ([target, skin], _, onCleanup) => {
      const request = ++generation;

      onCleanup(() => {
        generation++;
      });

      if (!target) {
        return;
      }

      try {
        // RenderAvatar draws after loading. Only copy the latest completed avatar onto the page.
        const image = document.createElement("canvas");

        await renderAvatar(image, { skin, "scale": 4 });

        if (generation === request) {
          target.width = image.width;
          target.height = image.height;
          const context = target.getContext("2d");

          if (!context) {
            throw new Error("Unable to draw the skin onto the avatar canvas");
          }

          context.drawImage(image, 0, 0);
          shown.value = true;
        }
      } catch (error) {
        if (generation === request) {
          report(error);
        }
      }
    }, { "flush": "post" });
  } else {
    watch(canvas, async (target, _, onCleanup) => {
      if (!target) {
        return;
      }

      let closed = false;

      onCleanup(() => {
        closed = true;
        viewer.value?.dispose();
        viewer.value = undefined;
        shown.value = false;
      });

      try {
        // Initialize with the local placeholder so teardown never waits for a remote skin.
        const created = await createSkinViewer({
          "canvas": target, "skin": FallbackSteve, "zoom": 35,
        });

        if (closed) {
          created.dispose();
        } else {
          viewer.value = created;
          configureDemandRendering(created, target);
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
      current?.render();
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
          current.render();
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