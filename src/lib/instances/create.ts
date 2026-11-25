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

import { message } from "@tauri-apps/plugin-dialog";

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { Patches, PrettyPatchLabels } from "@/constants/meta.ts";
import { Routes } from "@/constants/routes.ts";
import { sanitizeFileOrFolderName } from "@/lib/file-manager/path.ts";
import { log } from "@/lib/logging/log.ts";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

export function create(
  currentInstance: GlobalStatesType["pages"]["add-instance"]["instance"],
  uid: ExtendedPatchUIDType,
  modpackPath?: string,
): string | undefined;
export function create(
  currentInstance: GlobalStatesType["pages"]["add-instance"]["instance"],
  uid: ExtendedPatchUIDType,
  modpackPath: string,
  beforeRegister: (id: string) => Promise<void>,
): Promise<string> | undefined;
export function create(
  currentInstance: GlobalStatesType["pages"]["add-instance"]["instance"],
  uid: ExtendedPatchUIDType,
  modpackPath?: string,
  beforeRegister?: (id: string) => Promise<void>,
): string | Promise<string> | undefined {
  if (!currentInstance) {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the instance is undefined",
    );

    return undefined;
  }

  if (currentInstance.patchVersions[Patches.Minecraft] === undefined) {
    void message(
      "Please, select the Minecraft version.",
      {
        "title": "Instance creation",
        "kind" : "error",
      },
    );

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the Minecraft patch version is undefined",
    );

    return undefined;
  }

  if (currentInstance.patchVersions[uid] === undefined) {
    void message(
      `Please, specify the ${PrettyPatchLabels[uid]} version.`,
      {
        "title": "Instance creation",
        "kind" : "error",
      },
    );

    log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the entry patch version is undefined",
    );

    return undefined;
  }

  const toAdd: Partial<Record<ExtendedPatchUIDType, string>> = {};

  if (uid === Patches.FabricLoader) {
    // 'net.fabricmc.intermediary' should equal a Minecraft version
    toAdd[Patches.FabricIntermediary] = currentInstance.patchVersions[Patches.Minecraft];
  }

  const id = sanitizeFileOrFolderName(beforeRegister
    ? crypto.getRandomValues(new Uint8Array(16)).join("-") + " " + currentInstance.name
    : currentInstance.name + " " + Math.floor(Math.random() * 1000));

  log.debug(__PRE_BUNDLED_FILENAME__, "Creating an instance with the entry patch:", uid);

  const instance = {
    ...DefaultInstanceSettings,
    ...globalStates.minecraft,
    ...currentInstance,
    "patchVersions": {
      ...currentInstance.patchVersions,
      ...toAdd,
    },
    "entry": uid,
  };

  const page = globalStates.pages["add-instance"];
  const draft = page.instance;
  const archive = page.importedModpack;
  const draftValues = (): string => JSON.stringify([
    page.instance, page.importedModpack, page.instanceVersionSearch?.patch,
  ]);
  const initialValues = beforeRegister && draftValues();

  function register(): string {
    instanceStates[id] = {
      ...instance,
      ...(modpackPath && !beforeRegister ? { modpackPath } : {}),
    };
    log.info(__PRE_BUNDLED_FILENAME__, "Created an instance with the entry patch:", uid);
    if (beforeRegister) {
      if (globalStates.pages["add-instance"] !== page || page.instance !== draft ||
        page.importedModpack !== archive || draftValues() !== initialValues) {
        return id;
      }
      globalStates.selected.currentInstance = id;
      page.importedModpack = undefined;
      page.lastCreated = undefined;
    }
    page.instance = undefined;
    Router.navigate(Routes.Library);

    return id;
  }

  return beforeRegister ? beforeRegister(id).then(register) : register();
}
