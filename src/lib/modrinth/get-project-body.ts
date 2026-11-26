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

function hasBody(value: unknown): value is { "body": string } {
  return !!value && typeof value === "object" && "body" in value && typeof value.body === "string";
}

export async function getProjectBody(projectId: string): Promise<string> {
  const { "data": parsed } = await cachedMetadata({
    "baseDirectory": getBaseDirectory(),
    "relativePath" : `modrinth/${projectId}/project.json`,
    "url"          : `${ModrinthAPI.Endpoints.Project}/${projectId}`,
    "validate"     : hasBody,
  });

  return parsed.body;
}