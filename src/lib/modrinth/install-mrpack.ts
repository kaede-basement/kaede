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

import { Channel, invoke } from "@tauri-apps/api/core";
import { shallowRef } from "vue";

import { MrpackDependencies } from "@/constants/modrinth.ts";
import FileManager from "@/lib/file-manager";
import Instances from "@/lib/instances";
import { instanceStates } from "@/states/instance.ts";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";
import type { MrpackManifestType } from "@/types/modrinth/mrpack.type.ts";

export function resolvePatchVersions(
  dependencies: MrpackManifestType["dependencies"],
): InstanceStateType["patchVersions"] | undefined {
  const minecraft: string | undefined = dependencies.minecraft;

  if (minecraft === undefined) {
    return undefined;
  }

  const patchVersions: InstanceStateType["patchVersions"] = {
    "net.minecraft": minecraft,
  };

  for (const [key, version] of Object.entries(dependencies)) {
    const uid = MrpackDependencies[key];

    if (uid !== undefined) {
      patchVersions[uid] = version;
    }
  }

  return patchVersions;
}

export async function peekMrpack(archivePath: string): Promise<MrpackManifestType | undefined> {
  const manifest = await invoke<MrpackManifestType | null>("peek_mrpack", {
    archivePath,
  });

  return manifest ?? undefined;
}

export const ActiveInstall = shallowRef<{ "instanceId": string; "cancel": () => Promise<void> }>();

export async function installMrpack({
  archivePath,
  instanceId,
  statuses,
}: {
  "archivePath": string;
  "instanceId" : string;
  "statuses"   : LauncherStatusesType;
}): Promise<MrpackManifestType> {
  if (ActiveInstall.value) {
    throw new Error("Another modpack installation is active");
  }
  const { instanceRootDirectory } = Instances.getMinecraftDirectory({
    "baseDirectory": FileManager.getBaseDirectory(),
    instanceId,
  });
  const onProgress = new Channel<[number, number]>;

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  onProgress.onmessage = ([success, total]): void => {
    statuses.downloads.success = success;
    statuses.downloads.total = total;
  };

  const cancelId = `${instanceId}-download`;
  let ready = false;
  let requested = false;
  const cancel = async (): Promise<void> => {
    requested = true;
    if (ready) {
      await invoke("cancel_downloads", { cancelId });
    }
  };

  ActiveInstall.value = { instanceId, cancel };
  try {
    const reservation = await invoke<number>("prepare_mrpack_install", { cancelId });

    ready = true;
    if (requested) {
      await cancel();
    }

    return await invoke("install_mrpack", {
      archivePath, onProgress, cancelId, reservation, "targetDirPath": instanceRootDirectory,
    });
  } finally {
    ActiveInstall.value = undefined;
  }
}

export async function repairLegacyMrpack(
  instance: InstanceStateType,
  instanceId: string,
  minecraftDirectory: string,
  statuses: LauncherStatusesType,
): Promise<void> {
  const archivePath = instance.modpackPath;

  if (archivePath) {
    const onProgress = new Channel<[number, number]>;
    const { total, success } = statuses.downloads;
    let active = true;

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    onProgress.onmessage = ([done, count]): void => {
      if (active) {
        statuses.downloads.total = total + count;
        statuses.downloads.success = success + done;
      }
    };
    try {
      const result = await invoke<"repaired" | "archiveUnavailable">("repair_legacy_mrpack", {
        archivePath,
        onProgress,
        "targetDirPath": minecraftDirectory,
        "cancelId"     : `${instanceId}-download`,
      });

      if (result !== "repaired") {
        return;
      }
    } finally {
      active = false;
      statuses.downloads.total = total;
      statuses.downloads.success = success;
    }
    const saved = instanceStates[instanceId];

    if (saved?.modpackPath === archivePath) {
      const updated = { ...saved };

      delete updated.modpackPath;
      instanceStates[instanceId] = updated;
    }
  }
}
