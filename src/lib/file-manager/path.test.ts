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

import { expect, test } from "bun:test";

import { sanitizeFileOrFolderName } from "./path.ts";

const testData = [
  [
    "hi.ts",
    "hi.ts",
  ],
  [
    "「先生、なんだか心臓が痛いんです。先生のそばに居ると落ち着くんですけどソワソワして…顔も熱くなって心臓がバクバクしてるんです…治してくれませんか…？」\n" +
    "\n" +
    "ケイちゃんケイちゃん可愛いねぇ♡それは恋の病だよ♡私のことが好きなんだね♡私もケイちゃん好きだよ♡キスしたら治るらしいよ♡((殺",
    "_先生_なんだか心臓が痛いんです_先生のそばに居ると落ち着くんですけどソワソワして_顔も熱くなって心臓がバクバクしてるんです_治してくれませんか_____" +
    "ケイちゃんケイちゃん可愛いねぇ_それは恋の病だよ_私のことが好きなんだね_私もケイちゃん好きだよ_キ",
  ],
  [
    "해피 할로윈입니다 선생님!💙🩷 (1)",
    "해피_할로윈입니다_선생님_____1_",
  ],
] as const;

for (const [input, output] of testData) {
  const testName = `Sanitize File or Folder Name: ${JSON.stringify(input)}`;

  test(testName, () => {
    expect(sanitizeFileOrFolderName(input)).toBe(output);
  });
}
