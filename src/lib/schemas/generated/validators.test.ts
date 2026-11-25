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

import {
  CheckAccount,
} from "@/lib/schemas/generated/validators.ts";
import type { AccountType } from "@/types/configs/account.type.ts";

const placeholder: AccountType = {
  "msa"    : null,
  "profile": {
    "name": "windstone_",
    "type": "offline",
    "uuid": "0204254bf42f3ceeb58de7d6f7890452",
  },
  "skin": {
    "data"   : "",
    "id"     : "",
    "url"    : "",
    "variant": "classic",
  },
};

const testData = [
  [
    undefined,
    false,
  ],
  [
    { "development": {} },
    false,
  ],
  [

    /*
     * While 'accounts.json' represent an array of accounts,
     * 'CheckAccount' checks only one account entry
     */
    [],
    false,
  ],
  [
    placeholder,
    true,
  ],
  [
    { ...placeholder, "config/extra-field": { "supported": true } },
    true,
  ],
] as const;

function oneLevelDeep(key: string, value: unknown): unknown {
  if (key === "" || typeof value !== "object" || value === null) {
    return value;
  }

  return Array.isArray(value) ? "[Array]" : "[Object]";
}

for (const [input, output] of testData) {
  const testName = `Generated Validators (Account): ${JSON.stringify(input, oneLevelDeep)}`;

  test(testName, () => {
    /*
     * Checking only one exported function is enough since if one validator uses
     * non-clean boolean chains, the whole file should fail because of reference errors
     */
    expect(CheckAccount(input)).toBe(output);
  });
}
