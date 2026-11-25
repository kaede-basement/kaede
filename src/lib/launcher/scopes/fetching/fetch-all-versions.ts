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

import { APIEndpoints } from "@/constants/launcher.ts";
import { CustomPatches, Patches } from "@/constants/meta.ts";
import { cachedMetadata } from "@/lib/cache";
import { getBaseDirectory } from "@/lib/file-manager/path.ts";
import type {
  ExtendedPatchUIDType,
  PatchDependencyType,
  PatchIndexVersionType,
} from "@/types/launcher/meta/patch-index.type.ts";

type BMCLAPIOptiFineType = Partial<{
  "_id"      : string;
  "mcversion": string;
  "patch"    : string;
  "type"     : string;
  "__v"      : number;
  "filename" : string;
  "forge"    : string;
}>;

function hasVersions(value: unknown): value is { "versions": Array<PatchIndexVersionType> } {
  return !!value && typeof value === "object" && "versions" in value
    && Array.isArray(value.versions) && typeof value.versions[0]?.version === "string";
}

export async function fetchAllVersions(
  uid: ExtendedPatchUIDType,
  minecraftPatchVersion?: string,
): Promise<Array<PatchIndexVersionType>> {
  if (uid === CustomPatches.OptiFine) {
    // Example: 'https://bmclapi2.bangbang93.com/optifine/1.8.9'
    const versionEndpoint: string =
      APIEndpoints.BMCLAPI.Base +
      APIEndpoints.BMCLAPI.Paths.OptiFine.Base +
      minecraftPatchVersion;

    const { data } = await cachedMetadata({
      "baseDirectory": getBaseDirectory(),
      "relativePath" : `bmclapi/optifine/${minecraftPatchVersion}.json`,
      "url"          : versionEndpoint,
      "validate"     : Array.isArray,
    });

    // Reverse as it seems like first entries are the oldest ones
    return (data as Array<BMCLAPIOptiFineType>).reverse().map(entry => ({
      "version"    : `${entry?.mcversion ?? minecraftPatchVersion}_${entry?.type}_${entry?.patch}`,
      "sha256"     : "",
      "releaseTime": "1970-01-01T00:00:00Z",
      "recommended": false,
      "requires"   : [
        {
          "uid"   : Patches.Minecraft,
          "equals": minecraftPatchVersion,
        },
      ],
    }));
  }

  const url: string = APIEndpoints.Meta.Base + uid;
  const { "data": parsed } = await cachedMetadata({
    url,
    "baseDirectory"      : getBaseDirectory(),
    "relativePath"       : uid + ".json",
    "allowUnindexedPatch": true,
    "validate"           : hasVersions,
  });

  if (uid !== Patches.Minecraft && minecraftPatchVersion) {
    return parsed.versions.filter(currentVersion => {
      const requires: Array<PatchDependencyType> =
        currentVersion?.requires ?? [];

      for (const require of requires) {
        const neededVersion: string | undefined =
          require?.equals || require?.suggests;

        if (neededVersion === undefined) {
          continue;
        }

        if (neededVersion !== minecraftPatchVersion) {
          return false;
        }
      }

      return true;
    });
  }

  return parsed.versions;
}