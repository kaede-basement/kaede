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

export function getLogTargetColor(target: string): string {
  if (target.startsWith("webview:/src/lib/schemas")) {
    return "text-orange-300";
  }

  if (target.startsWith("webview:/src/lib/extensions-manager")) {
    return "text-fuchsia-300";
  }

  if (target.startsWith("webview:/src/lib/")) {
    return "text-lime-300";
  }

  if (target.startsWith("webview:/src/components")) {
    return "text-sky-300";
  }

  if (target.startsWith("webview:")) {
    return "text-teal-200";
  }

  return "text-neutral-300";
}
