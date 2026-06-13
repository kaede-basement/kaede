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

// @ts-expect-error No TypeScript declaration file found
import * as Hashes from "jshashes";

export function hashFileContents(image: Uint8Array): string {
  const SHA256 = new Hashes.SHA256;

  SHA256.setUTF8(false);

  const contents: Array<string> = [];

  // 'image.map' does not really work in this case
  for (const byte of image) {
    contents.push(String.fromCodePoint(byte));
  }

  return SHA256.hex(contents.join(""));
}