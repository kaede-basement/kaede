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

import { Routes } from "@/constants/routes.ts";
import General from "@/lib/general";
import GlobalStateHelpers from "@/lib/global-state-helpers";
import Instances from "@/lib/instances";
import { log } from "@/lib/logging/scopes/log.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export async function createInstance(
  currentInstance: GlobalStatesType["pages"]["states"]["add-instance"]["instance"],
): Promise<void> {
  if (!currentInstance) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      "Could not create an instance since the instance is undefined",
    );
  }

  const randomDigits: number = Math.floor(Math.random() * 1000);
  const id: string =
    "instance_" + randomDigits + "_" +
    General.hashString(currentInstance.name).toString();

  await Instances.add(id, currentInstance);

  GlobalStateHelpers.Pages.addToState("add-instance", {
    "instance": undefined,
  });

  return GlobalStateHelpers.Pages.navigate(Routes.Home);
}