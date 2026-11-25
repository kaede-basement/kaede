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

import type { ExtensionUI } from "@/lib/extensions/sandbox/ui-root.ts";
import { handleInternetPermission } from "@/lib/permissions/atomic/internet.ts";
import { handleLoggingPermission } from "@/lib/permissions/atomic/logging.ts";
import { handleTimePermission } from "@/lib/permissions/atomic/time.ts";
import { handleUIPermission } from "@/lib/permissions/atomic/ui.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";

export function handlePermission(
  raw: string, id: string, ui?: ExtensionUI, signal?: AbortSignal,
): unknown {
  const parsed = parsePermission(raw);

  if (!parsed) {
    throw new TypeError("Invalid permission");
  }
  switch (parsed.base) {
    case "time": {
      return handleTimePermission({ id, "scope": parsed.scope });
    }
    case "ui": {
      return handleUIPermission({ id, "scope": parsed.scope, ui });
    }
    case "log": {
      return handleLoggingPermission({ id, "scope": parsed.scope, signal });
    }
    case "internet": {
      const scope = { id, "scope": parsed.scope, "argument": parsed.url };

      return handleInternetPermission(scope, signal);
    }
  }
}
