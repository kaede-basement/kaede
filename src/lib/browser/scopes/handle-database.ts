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

import type { DatabaseType } from "@/types/browser/database.type.ts";

export async function handleDatabase(): Promise<DatabaseType> {
  const request: IDBOpenDBRequest = indexedDB.open("kaedeBrowserDB", 4);

  request.addEventListener("upgradeneeded", (): void => {
    const currentDatabase: IDBDatabase = request.result;

    if (!currentDatabase.objectStoreNames.contains("general")) {
      currentDatabase.createObjectStore("general", {
        "keyPath"      : "id",
        "autoIncrement": true,
      });
    }
    if (!currentDatabase.objectStoreNames.contains("logs")) {
      currentDatabase.createObjectStore("logs", {
        "keyPath"      : "id",
        "autoIncrement": true,
      });
    }
  }, { "once": true });

  return new Promise(resolve => {
    let database: DatabaseType["database"];

    request.addEventListener("success", (): void => {
      database = request.result;

      resolve({ database });
    }, { "once": true });
    request.addEventListener("error", (): void => {
      // eslint-disable-next-line no-console
      console.log("Error in Indexed DB:", request.error);

      resolve({ database });
    }, { "once": true });
  });
}