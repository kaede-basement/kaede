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

import { invoke } from "@tauri-apps/api/core";

import type { MrpackSummaryType } from "@/types/modrinth/mrpack.type.ts";

export type RawMrpackSummary = Omit<MrpackSummaryType, "fileCount"> & {
  "fileCount"?: number;
  "files"?    : ReadonlyArray<unknown>;
};

// External browser/Wails bridges still return a full 'files' array for peek/install.
export function normalizeMrpackSummary(raw: RawMrpackSummary): MrpackSummaryType {
  return {
    "formatVersion": raw.formatVersion,
    "name"         : raw.name,
    "versionId"    : raw.versionId,
    "summary"      : raw.summary,
    "dependencies" : raw.dependencies,
    "fileCount"    : raw.fileCount ?? raw.files?.length ?? 0,
    "overrides"    : raw.overrides,
  };
}

export async function peekMrpack(archivePath: string): Promise<MrpackSummaryType | undefined> {
  const manifest = await invoke<RawMrpackSummary | null>("peek_mrpack", {
    archivePath,
  });

  return manifest ? normalizeMrpackSummary(manifest) : undefined;
}
