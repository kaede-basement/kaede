import { expect, test } from "bun:test";

import { parseOptiFineVersion } from "./parse-optifine-version.ts";

const testData = [
  // Regular releases
  ["1.8.9_HD_U_M5", { "minecraftVersion": "1.8.9", "type": "HD_U", "patch": "M5" }],
  ["1.12.2_HD_U_G5", { "minecraftVersion": "1.12.2", "type": "HD_U", "patch": "G5" }],
  ["1.18.1_HD_U_H4", { "minecraftVersion": "1.18.1", "type": "HD_U", "patch": "H4" }],
  ["1.21.4_HD_U_J3", { "minecraftVersion": "1.21.4", "type": "HD_U", "patch": "J3" }],

  // Preview releases
  ["1.21.4_HD_U_J3_pre14", { "minecraftVersion": "1.21.4", "type": "HD_U_J3", "patch": "pre14" }],
  ["1.8.9_HD_U_L6_pre1", { "minecraftVersion": "1.8.9", "type": "HD_U_L6", "patch": "pre1" }],
  ["1.18.1_HD_U_H5_pre6", { "minecraftVersion": "1.18.1", "type": "HD_U_H5", "patch": "pre6" }],

  ["1.20_HD_U_I5", { "minecraftVersion": "1.20", "type": "HD_U", "patch": "I5" }],

  ["", false],
  ["1.8.9", false],
  ["1.8.9_", false],
] as const;

for (const [version, expected] of testData) {
  const testName = `OptiFine Version: ${version}`;

  test(testName, () => {
    expect(parseOptiFineVersion(version)).toEqual(expected);
  });
}
