<script setup lang="ts">
import { ref } from "vue";

import MaterialRipple from "@/components/general/base/MaterialRipple.vue";
import { ApplicationNamespace } from "@/constants/application.ts";
import { __requestPermissions } from "@/lib/extensions-manager/scopes/request-permissions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

const requestedPermissionState = ref<{
  "id"       : PermissionType;
  "extension": string;
  "resolve"  : (state: boolean) => void;
} | undefined>(undefined);

function showContextMenu(event: MouseEvent): void {
  window[ApplicationNamespace].libs.ContextMenu.show(event);
}

function handlePermissionRequest(
  permission?: PermissionType,
  extension?: string,
  resolve?: (state: boolean) => void,
): void {
  if (!permission || !extension || !resolve) {
    requestedPermissionState.value = undefined;

    return;
  }

  requestedPermissionState.value = {
    "id"       : permission,
    "extension": extension,
    "resolve"  : resolve,
  };
}

function requestPermissions(
  permissions: Array<PermissionType>,
  extension: string,
): Promise<Array<boolean>> {
  return __requestPermissions(permissions, extension, handlePermissionRequest);
}

function allowRequest(): void {
  requestedPermissionState.value?.resolve?.(true);
}
function denyRequest(): void {
  requestedPermissionState.value?.resolve?.(false);
}

window[ApplicationNamespace].__internals.requestPermissions = requestPermissions;
</script>

<template>
  <Transition name="pop">
    <div
      v-if="requestedPermissionState"
      id="__extensions-loader__permission-request-wrapper"
      @contextmenu.prevent
      @contextmenu="showContextMenu"
      class="absolute bottom-0 left-0 right-0 top-0 z-49500 grid place-items-center bg-[theme(colors.black/.5)]"
    >
      <div
        @contextmenu.prevent
        id="__extensions-loader__permission-request-inner"
        class="max-w-72 w-full flex flex-col items-start gap-4 rounded-md bg-neutral-900 p-2"
      >
        <div
          id="__extensions-loader__permission-request-information"
          class="flex flex-nowrap gap-4 p-2"
        >
          <div
            id="__extensions-loader__permission-request-information-icon"
            class="i-lucide-globe mt-1 size-6 shrink-0"
          ></div>
          <div
            id="__extensions-loader__permission-request-information-title"
            class="text-lg text-neutral-300"
          >
            <span
              id="__extensions-loader__permission-request-information-title-before"
            >
              Allow
            </span>
            <span
              id="__extensions-loader__permission-request-information-title-extension"
              class="text-white font-medium"
            >
              {{ requestedPermissionState.extension }}
            </span>
            <span
              id="__extensions-loader__permission-request-information-title-after"
            >
              to access {{ requestedPermissionState.id }}?
            </span>
          </div>
        </div>
        <div
          id="__extensions-loader__permission-request-control"
          class="w-full flex flex-nowrap items-center justify-end gap-2"
        >
          <button
            id="__extensions-loader__permission-request-allow-wrapper"
            @click="allowRequest"
            class="relative rounded-md px-2 py-1"
          >
            <span
              id="__extensions-loader__permission-request-allow-label"
              class="text-neutral-300"
            >
              Allow
            </span>
            <MaterialRipple />
          </button>
          <button
            id="__extensions-loader__permission-request-deny-wrapper"
            @click="denyRequest"
            class="relative rounded-md px-2 py-1"
          >
            <span
              id="__extensions-loader__permission-request-deny-label"
              class="text-neutral-300"
            >
              Deny
            </span>
            <MaterialRipple />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>