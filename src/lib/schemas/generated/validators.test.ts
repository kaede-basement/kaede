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

import { DefaultInstanceSettings } from "@/constants/launcher.ts";
import { getDefaultConfig } from "@/lib/configs/scopes/get-default-config.ts";
import {
  CheckAccount, CheckConfig, CheckExtensionMetadata, CheckInstanceMetadata, CheckPatchMeta,
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
    expect(CheckAccount(input)).toBe(output);
  });
}

const config = await getDefaultConfig();
const patch = { "name": "Custom", "uid": "custom", "version": "1", "formatVersion": 1 };

test("Validate config, extension, instance and patch metadata", () => {
  const extension = {
    "name"      : "Test",
    "logo"      : "",
    "source"    : "",
    "version"   : "1",
    "type"      : "sandbox",
    "authors"   : [],
    "languages" : [],
    "categories": [],
  };
  const instance = {
    ...config.minecraft, ...DefaultInstanceSettings, "patchVersions": { "net.minecraft": "1" },
  };

  expect(CheckConfig(config)).toBe(true);
  expect(CheckConfig({ ...config, "java": null })).toBe(false);
  expect(CheckExtensionMetadata(extension)).toBe(true);
  expect(CheckExtensionMetadata({ ...extension, "type": "unknown" })).toBe(false);
  expect(CheckInstanceMetadata(instance)).toBe(true);
  expect(CheckInstanceMetadata({ ...instance, "playTime": null })).toBe(false);
  const artifact = { "url": "https://example.org/client.jar", "sha1": "abc", "size": 123 };

  for (const [input, valid] of [
    [{}, false], [{ "url": 12, "sha1": false, "size": "bad" }, false], [artifact, true],
  ] as const) {
    const jar = { "name": "example:client:1", "downloads": { "artifact": input } };

    expect(CheckPatchMeta({ ...patch, "mainJar": jar })).toBe(valid);
    expect(CheckPatchMeta({ ...patch, "libraries": [jar] })).toBe(valid);
  }
  expect(CheckPatchMeta(patch)).toBe(true);
  expect(CheckPatchMeta({
    ...patch,
    "mainJar": { "name": "example:client:1", "url": "https://repo.example/maven/" },
  })).toBe(true);
  expect(CheckPatchMeta({
    ...patch,
    "mainJar": { "name": "example:client:1", "downloads": { "artifact": null } },
  })).toBe(false);
  expect(CheckPatchMeta({
    ...patch,
    "libraries": [{ "name": "custom:library:1", "rules": [{ "action": "allow" }] }],
  })).toBe(true);
  expect(CheckPatchMeta({ ...patch, "uid": null })).toBe(false);
});

for (const field of [
  "releaseTime",
  "+libraries",
  "+traits",
  "+tweakers",
  "assetIndex",
  "compatibleJavaMajors",
  "compatibleJavaName",
  "conflicts",
  "libraries",
  "logging",
  "mainClass",
  "mainJar",
  "mavenFiles",
  "minecraftArguments",
  "order",
  "requires",
  "runtimes",
  "type",
  "volatile",
]) {
  test(`Patch metadata rejects null ${field}`, () => {
    expect(CheckPatchMeta({ ...patch, [field]: null })).toBe(false);
  });
}
