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

import { ModrinthAPI } from "@/constants/modrinth.ts";
import { cachedMetadata } from "@/lib/cache";
import { getBaseDirectory } from "@/lib/file-manager/path.ts";

type Version = {
  "id"            : string;
  "featured"      : boolean;
  "game_versions" : Array<string>;
  "loaders"       : Array<string>;
  "name"          : string;
  "version_number": string;
  "files"         : Array<Partial<{
    "id"    : string;
    "hashes": {
      "sha1"  : string;
      "sha512": string;
    };
    // The '.mrpack' file
    "url"      : string;
    "filename" : string;
    "primary"  : boolean;
    "size"     : number;
    "file_type": null;
  }>>;
};

function strings(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function validVersions(value: unknown): value is Array<Version> {
  return Array.isArray(value) && value.every(row => {
    return row && typeof row.id === "string" && typeof row.name === "string"
      && typeof row.featured === "boolean" && typeof row.version_number === "string"
      && strings(row.game_versions) && strings(row.loaders)
      && Array.isArray(row.files) && row.files.every((file: unknown) => validFile(file));
  });
}

function validFile(value: unknown): boolean {
  if (!value || typeof value !== "object" || !("filename" in value)
    || typeof value.filename !== "string"
    || !("url" in value) || typeof value.url !== "string" || !value.url.trim()
    || !("size" in value) || typeof value.size !== "number" || !Number.isSafeInteger(value.size)
    || value.size < 0 || ("primary" in value && typeof value.primary !== "boolean")) return false;
  if (!("hashes" in value) || !value.hashes || typeof value.hashes !== "object") return false;
  const hashes = value.hashes;

  return "sha1" in hashes && typeof hashes.sha1 === "string" && (/^[\da-f]{40}$/i).test(hashes.sha1)
    && "sha512" in hashes && typeof hashes.sha512 === "string"
    && (/^[\da-f]{128}$/i).test(hashes.sha512);
}

export async function fetchVersion(projectId: string): Promise<Array<Version>> {
  const { "data": parsed } = await cachedMetadata({
    "baseDirectory": getBaseDirectory(),
    "relativePath" : `modrinth/${projectId}/versions.json`,
    "url"          : `${ModrinthAPI.Endpoints.Project}/${projectId}/version`,
    "validate"     : validVersions,
  });

  return parsed;
}