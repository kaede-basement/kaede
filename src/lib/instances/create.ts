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
import FileManager from "@/lib/file-manager";
import { sanitizeFileOrFolderName } from "@/lib/file-manager/path.ts";
import { translate } from "@/lib/general/translate.ts";
import { registerInstance } from "@/lib/instances/sync.ts";
import { log } from "@/lib/logging/log.ts";
import {
  archiveIdentity, persistImportArchive, setImportedModpack,
} from "@/lib/modrinth/import-archive.ts";
import Router from "@/lib/router";
import { globalStates } from "@/states/global.ts";
import { instanceStates } from "@/states/instance.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { ExtendedPatchUIDType } from "@/types/launcher/meta/patch-index.type.ts";

type Page = GlobalStatesType["pages"]["add-instance"];
type Import = { "path": string; "install": (id: string) => Promise<void> };
type PendingRegistration = {
  "directory": string;
  "path"     : string;
  "identity" : string;
  "id"       : string;
};
const awaitingMetadata = new WeakMap<Page, PendingRegistration>;

function prepare(
  currentInstance: Page["instance"], uid: ExtendedPatchUIDType,
): InstanceStateType | undefined {
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

  log.debug(__PRE_BUNDLED_FILENAME__, "Creating an instance with the entry patch:", uid);

  return {
    ...DefaultInstanceSettings,
    ...globalStates.minecraft,
    ...currentInstance,
    "patchVersions": {
      ...currentInstance.patchVersions,
      ...toAdd,
    },
    "entry": uid,
  };
}

export function createFromDraft(
  draft: Page["instance"], uid: ExtendedPatchUIDType, pack?: Import,
): Promise<string> | undefined {
  const instance = prepare(draft, uid);

  if (instance) {
    return saveDraft(instance, pack);
  }
}

async function saveDraft(instance: InstanceStateType, pack?: Import): Promise<string> {
  const page = globalStates.pages["add-instance"];
  const draft = page.instance;
  const archive = page.importedModpack;
  const draftValues = (): string => JSON.stringify([
    page.instance, page.importedModpack, page.instanceVersionSearch,
  ]);
  const initialValues = draftValues();
  const directory = FileManager.getBaseDirectory();
  const identity = pack && await archiveIdentity(pack.path);
  const pending = awaitingMetadata.get(page);
  const retryId = pending && pending.directory === directory && pending.path === pack?.path &&
    pending.identity === identity
    ? pending.id
    : undefined;
  const id = retryId ?? sanitizeFileOrFolderName(
    crypto.getRandomValues(new Uint8Array(16)).join("-") + " " + instance.name,
  );

  if (pack && !retryId) {
    await pack.install(id);
  }
  if (!await registerInstance(id, instance)) {
    if (pack && identity) {
      awaitingMetadata.set(page, { directory, "path": pack.path, identity, id });
    }
    const key = pack ? "import.metadata-save-error" : "instance.metadata-save-error";

    throw new Error(translate(key));
  }

  if (pending === awaitingMetadata.get(page)) {
    awaitingMetadata.delete(page);
  }

  if (globalStates.pages["add-instance"] === page && page.instance === draft &&
    page.importedModpack === archive && draftValues() === initialValues) {
    if (pack) {
      setImportedModpack();
      page.lastCreated = undefined;
    }
    page.instance = undefined;
    page.instanceVersionSearch = undefined;
    if (globalStates.currentPage === Routes.AddInstance &&
      (page.tab ?? "clean-minecraft") === "clean-minecraft") {
      globalStates.selected.currentInstance = id;
      Router.navigate(Routes.Home);
    }
  }

  return id;
}

export function create(
  currentInstance: Page["instance"], uid: ExtendedPatchUIDType, modpackPath?: string,
): string | undefined;
export function create(
  currentInstance: Page["instance"], uid: ExtendedPatchUIDType, modpackPath: string,
  beforeRegister: (id: string) => Promise<void>,
): Promise<string> | undefined;
export function create(
  currentInstance: Page["instance"], uid: ExtendedPatchUIDType, modpackPath?: string,
  beforeRegister?: (id: string) => Promise<void>,
): string | Promise<string> | undefined {
  if (beforeRegister && modpackPath !== undefined) {
    return createFromDraft(currentInstance, uid, {
      "path": modpackPath, "install": beforeRegister,
    });
  }
  const instance = prepare(currentInstance, uid);

  if (!instance) {
    return;
  }

  const id = sanitizeFileOrFolderName(instance.name + " " + Math.floor(Math.random() * 1000));

  if (modpackPath) {
    instance.modpackPath = modpackPath;
    persistImportArchive(modpackPath);
  }
  instanceStates[id] = instance;
  globalStates.pages["add-instance"].instance = undefined;
  Router.navigate(Routes.Library);

  return id;
}
