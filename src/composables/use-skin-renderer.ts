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
  onBeforeUnmount, type Ref,
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
  let rendering = false;
  let closed = false;
  let appliedSkin: string | undefined;

  onBeforeUnmount(() => {
    closed = true;
    generation++;
    viewer.value?.dispose();
    viewer.value = undefined;
  });

  watch([canvas, source, slim], async () => {
    generation++;

    if (rendering || closed) {
      return;
    }

    rendering = true;

    try {
      while (canvas.value && !closed) {
        const request = generation;
        const target = canvas.value;
        const skin = source.value;
        const isSlim = slim.value;

        try {
          if (render === "2d-head") {
            await renderAvatar(target, { skin, "scale": 4 });
          } else if (viewer.value) {
            if (skin !== appliedSkin) {
              await viewer.value.setSkin(skin);
              appliedSkin = skin;
            }

            if (request === generation) {
              viewer.value.setSlim(isSlim);
            }
          } else {
            const created = await createSkinViewer({
              "canvas": target, skin, "slim": isSlim, "zoom": 35,
            });

            if (closed || canvas.value !== target) {
              created.dispose();

              return;
            }

            viewer.value = created;
            appliedSkin = skin;
            created.startRenderLoop();
          }

          if (request === generation) {
            shown.value = true;
          }
        } catch (error: unknown) {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            `Error rendering the '${render}' skin:`,
            Errors.prettify(error),
          );
        }

        if (request === generation) {
          break;
        }
      }
    } finally {
      rendering = false;
    }
  }, { "flush": "post" });

  return { canvas, shown, viewer };
}