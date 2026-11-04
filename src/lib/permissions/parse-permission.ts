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

import { PermissionsList } from "@/constants/permissions.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

export type ParsedPermissionType = {
  // 'base::scope'
  "key"     : PermissionType;
  // The dynamic part after 'base::scope::', e.g., an allowed URL
  "argument": string | undefined;
};

function isPermissionKey(key: string): key is PermissionType {
  return (PermissionsList as Array<string>).includes(key);
}

function isURL(input: string): boolean {
  try {
    new URL(input);

    return true;
  } catch {
    return false;
  }
}

/**
 * Parses 'base::scope[::argument]'. Internet permissions require a URL argument,
 * other permissions must not have one.
 *
 * @param permission - an untrusted value that should be a permission string
 * @returns the parsed permission, or 'undefined' if the value is not a known permission
 */
export function parsePermission(permission: unknown): ParsedPermissionType | undefined {
  if (typeof permission !== "string") {
    return undefined;
  }

  const first: number = permission.indexOf("::");
  const second: number = first === -1 ? -1 : permission.indexOf("::", first + 2);
  // An argument may contain '::' itself, e.g., 'http://[::1]/'
  const key: string = second === -1 ? permission : permission.slice(0, second);
  const argument: string | undefined = second === -1 ? undefined : permission.slice(second + 2);

  if (!isPermissionKey(key)) {
    return undefined;
  }

  const needsArgument: boolean = key.startsWith("internet::");
  const validArgument: boolean = needsArgument
    ? argument !== undefined && isURL(argument)
    : argument === undefined;

  return validArgument ? { key, argument } : undefined;
}
