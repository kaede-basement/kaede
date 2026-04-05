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

import { getDatabaseStore } from "@/lib/browser/scopes/get-database-store.ts";

export function handleLogsFlush(): void {
  setInterval(() => {
    const KaedeInternals = window.__KAEDE__.__internals;
    const database: IDBDatabase | undefined = KaedeInternals.indexedDB;
    const currentLogs: Array<string> | undefined = KaedeInternals.logsInBrowser;

    if (!database || !currentLogs) {
      return;
    }

    const store: IDBObjectStore = getDatabaseStore("logs", database);

    for (const message of currentLogs) {
      store.add({ message });
    }

    currentLogs.length = 0;
  }, 300);
}