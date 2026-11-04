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

import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

/*
 * Matching by the code hash would let an archive with replaced metadata (e.g., more permissions)
 * inherit the enabled state and skip the permissions confirmation
 */
export function findListIndex(
  list: GlobalStatesType["extensions"]["list"],
  { artifactSha256 }: Pick<ExtensionType, "artifactSha256">,
): number {
  return list.findIndex(({ sha256 }) => sha256 === artifactSha256);
}
