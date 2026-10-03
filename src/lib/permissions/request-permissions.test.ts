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

import { beforeEach, expect, mock, test } from "bun:test";

// 'harden' comes from 'lockdown()', which would freeze the intrinsics of the whole test process
(globalThis as unknown as { "harden": <T>(value: T) => T }).harden = <T>(value: T): T => value;

const storedPermissions: Record<string, Record<string, boolean>> = {};
const failingPermission = "internet::http-get";

mock.module("@/states/global.ts", () => ({
  "globalStates": { "extensions": { "permissions": storedPermissions } },
}));
mock.module("@/lib/permissions/handle-permission.ts", () => ({
  "handlePermission": (permission: string): string => {
    if (permission === failingPermission) {
      throw new TypeError("Internet permissions must include a URL scope");
    }

    return "granted scope";
  },
}));

const { grantStaticPermissions } = await import("@/lib/permissions/grant-static-permissions.ts");
const {
  __cancelPermissionRequests,
  __requestPermissions,
} = await import("@/lib/permissions/request-permissions.ts");

const pluginId: string = "plugin";
const permission = "time::performance";

// Answers every prompt with 'answer' and records which permissions were prompted
function prompter(answer: boolean): {
  "prompted": Array<string>;
  "request" : (permission?: string, extension?: string, resolve?: (state: boolean) => void) => void;
} {
  const prompted: Array<string> = [];

  return {
    prompted,
    "request": (permission, _extension, resolve): void => {
      if (permission && resolve) {
        prompted.push(permission);
        resolve(answer);
      }
    },
  };
}

beforeEach(() => {
  for (const key of Object.keys(storedPermissions)) {
    delete storedPermissions[key];
  }
});

test("a static grant is invisible to another artifact with the same ID", async () => {
  grantStaticPermissions({
    "id"            : pluginId,
    "artifactSha256": "artifact-x",
    "permissions"   : [permission],
  });

  const { prompted, request } = prompter(false);
  const granted = await __requestPermissions([permission], pluginId, "artifact-y", request);

  expect(prompted).toEqual([permission]);
  expect(granted).toEqual([false]);
});

test("a requested grant is invisible to another artifact with the same ID", async () => {
  const first = prompter(true);

  expect(await __requestPermissions([permission], pluginId, "artifact-x", first.request))
    .toEqual(["granted scope"]);

  const second = prompter(false);
  const granted = await __requestPermissions([permission], pluginId, "artifact-y", second.request);

  expect(second.prompted).toEqual([permission]);
  expect(granted).toEqual([false]);
});

test("a grant stays visible to the same artifact", async () => {
  grantStaticPermissions({
    "id"            : pluginId,
    "artifactSha256": "artifact-x",
    "permissions"   : [permission],
  });

  const { prompted, request } = prompter(false);
  const granted = await __requestPermissions([permission], pluginId, "artifact-x", request);

  expect(prompted).toEqual([]);
  expect(granted).toEqual(["granted scope"]);
});

test("a legacy grant under an ID equal to an artifact hash is not its grant", async () => {
  // Grants used to be keyed by plugin ID, which is the archive file name
  storedPermissions["artifact-x"] = { [permission]: true };

  const { prompted, request } = prompter(false);
  const granted = await __requestPermissions([permission], pluginId, "artifact-x", request);

  expect(prompted).toEqual([permission]);
  expect(granted).toEqual([false]);
});

// Holds one prompt at a time, like 'PermissionsHandler.vue'
function modal(): {
  "shown"  : () => string | undefined;
  "answer" : (state: boolean) => void;
  "request": (permission?: string, extension?: string, resolve?: (state: boolean) => void) => void;
} {
  let state: { "permission": string; "resolve": (state: boolean) => void } | undefined;

  return {
    "shown"  : (): string | undefined => state?.permission,
    "answer" : (answer: boolean): void => state?.resolve(answer),
    "request": (permission, _extension, resolve): void => {
      state = permission === undefined || resolve === undefined
        ? undefined
        : { permission, resolve };
    },
  };
}

test("overlapping requests each get their own answer", async () => {
  const { shown, answer, request } = modal();
  const first = __requestPermissions([permission], pluginId, "artifact-x", request);
  const empty = __requestPermissions([], pluginId, "artifact-z", request);
  const second = __requestPermissions([permission], pluginId, "artifact-y", request);

  await Bun.sleep(0);
  expect(shown()).toBe(permission);
  answer(true);
  expect(await first).toEqual(["granted scope"]);
  expect(await empty).toEqual([]);

  await Bun.sleep(0);
  expect(shown()).toBe(permission);
  answer(false);
  expect(await second).toEqual([false]);
  expect(shown()).toBeUndefined();
});

test("a failing grant rejects and dismisses the prompt", async () => {
  const { shown, answer, request } = modal();
  const failing = __requestPermissions([failingPermission], pluginId, "artifact-x", request);

  await Bun.sleep(0);
  answer(true);
  await expect(failing).rejects.toThrow("URL scope");
  expect(shown()).toBeUndefined();

  const next = __requestPermissions([permission], pluginId, "artifact-x", request);

  await Bun.sleep(0);
  answer(true);
  expect(await next).toEqual(["granted scope"]);
});

test("an unknown permission rejects without a prompt and does not block others", async () => {
  const { shown, answer, request } = modal();

  await expect(__requestPermissions([""], pluginId, "artifact-x", request))
    .rejects.toThrow("Unknown permission");
  expect(shown()).toBeUndefined();

  const next = __requestPermissions([permission], pluginId, "artifact-y", request);

  await Bun.sleep(0);
  expect(shown()).toBe(permission);
  answer(true);
  expect(await next).toEqual(["granted scope"]);
});

test("closing the prompt rejects the active and the waiting requests", async () => {
  const { shown, request } = modal();
  const active = __requestPermissions([permission], pluginId, "artifact-x", request);
  const waiting = __requestPermissions([permission], pluginId, "artifact-y", request);

  await Bun.sleep(0);
  __cancelPermissionRequests();

  await expect(active).rejects.toThrow("closed");
  await expect(waiting).rejects.toThrow("closed");
  expect(shown()).toBeUndefined();
  expect(storedPermissions).toEqual({});

  // A prompt mounted again serves new requests
  const reopened = modal();
  const next = __requestPermissions([permission], pluginId, "artifact-x", reopened.request);

  await Bun.sleep(0);
  reopened.answer(true);
  expect(await next).toEqual(["granted scope"]);
});

test("the extension cannot change the permissions after they are checked", async () => {
  const { shown, answer, request } = modal();
  const lying = [""];

  Object.defineProperty(lying, "findIndex", { "value": (): number => -1 });
  await expect(__requestPermissions(lying, pluginId, "artifact-x", request))
    .rejects.toThrow("Unknown permission");

  const changing = [permission, "time::date"];
  const changed = __requestPermissions(changing, pluginId, "artifact-y", request);

  await Bun.sleep(0);
  changing[1] = "";
  answer(true);
  await Bun.sleep(0);
  expect(shown()).toBe("time::date");
  answer(true);
  expect(await changed).toEqual(["granted scope", "granted scope"]);
});

test("a request from an extension with an empty ID is prompted", async () => {
  const { shown, answer, request } = modal();
  const empty = __requestPermissions([permission], "", "artifact-x", request);

  await Bun.sleep(0);
  expect(shown()).toBe(permission);
  answer(false);
  expect(await empty).toEqual([false]);
});
