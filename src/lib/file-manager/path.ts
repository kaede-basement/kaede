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

import { invoke } from "@tauri-apps/api/core";

import { GlobalInternals } from "@/extendable/global-internals.ts";

/**
 * @returns a string that represents an absolute path to the base directory
 */
export function getBaseDirectory(): string {
  return GlobalInternals.baseDirectory;
}

/**
 * Joins an array of paths using a delimiter that is found out
 * by calling 'std::path::MAIN_SEPARATOR' in the Rust code
 *
 * @param paths - an array of path strings
 * @returns a joined path string
 */
export function join(...paths: Array<string>): string {
  const delimiter = GlobalInternals.joinDelimiter;
  const cleanedPaths: Array<string> = [];

  for (const path of paths) {
    if (path !== "") {
      cleanedPaths.push(path);
    }
  }

  return cleanedPaths.join(delimiter);
}

/**
 * Replaces all characters that are not Unicode letters, numbers, or dots with an underscore.
 * Also limits the string length to 127 characters to be safe
 *
 * @param input - an arbitrary string
 * @returns a sanitized file or folder name
 */
export function sanitizeFileOrFolderName(input: string): string {
  // Refer to https://www.regular-expressions.info/unicode.html#prop
  return input
    .replace(/[^\p{L}\p{N}.]/gu, "_")
    .slice(0, 127);
}

/**
 * Verifies an array of paths by either checking for the path presence
 * or calculating and comparing SHA1 hashes
 *
 * @param paths - an array of absolute file paths
 * @param sha1 - an optional boolean that tells whether to verify by SHA1 or not
 * @returns an array of absolute file paths that were invalid
 */
export function verifyPaths({
  paths,
  sha1,
}: {
  "paths": Array<{ "path": string; "hash": string }>;
  "sha1"?: boolean;
}): Promise<Array<string>> {
  if (sha1) {
    return invoke("verify_file_paths", {
      "artifacts": paths,
    });
  }

  return invoke("get_missing_files", {
    "paths": paths.map(({ path }) => path),
  });
}
