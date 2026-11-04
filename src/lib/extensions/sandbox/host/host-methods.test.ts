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
  createHostMethods,
  type SandboxFetchRequestType,
} from "@/lib/extensions/sandbox/host/host-methods.ts";
import type { SandboxHostType } from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import type { SandboxFetchResponse } from "@/lib/extensions/sandbox/protocol.ts";

const host = {} as SandboxHostType;
const response: SandboxFetchResponse = {
  "status"     : 200,
  "statusText" : "OK",
  "ok"         : true,
  "redirected" : false,
  "type"       : "basic",
  "url"        : "https://example.com/a",
  "contentType": "text/plain",
  "body"       : new ArrayBuffer(0),
};

function createMethods(grants: Set<string>): {
  "methods" : ReturnType<typeof createHostMethods>;
  "logs"    : Array<Array<string>>;
  "requests": Array<SandboxFetchRequestType>;
} {
  const logs: Array<Array<string>> = [];
  const requests: Array<SandboxFetchRequestType> = [];
  const methods = createHostMethods({
    "isGranted"         : permission => grants.has(permission),
    "requestPermissions": async () => [],
    "writeLog"          : (level, input) => logs.push([level, ...input]),
    "readLog"           : async () => "log",
    "fetch"             : async request => {
      requests.push(request);

      return response;
    },
  });

  return { methods, logs, requests };
}

test("Host Methods: checks the grant at call time", () => {
  const grants = new Set(["log::write"]);
  const { methods, logs } = createMethods(grants);
  const write = { "permission": "log::write", "level": "info", "input": ["hello"] };

  methods["log.write"].handle(write, host);
  grants.delete("log::write");

  expect(() => methods["log.write"].handle(write, host)).toThrow("not granted");
  expect(logs).toEqual([["info", "hello"]]);
});

test("Host Methods: rejects a permission of another kind", () => {
  const { methods } = createMethods(new Set(["log::read", "log::write"]));

  expect(() => methods["log.write"].handle({
    "permission": "log::read",
    "level"     : "info",
    "input"     : [],
  }, host)).toThrow("unexpected permission");
  expect(() => methods["log.read"].handle({ "permission": "log::reader" }, host))
    .toThrow("unexpected permission");
  expect(() => methods["log.read"].handle(["log::read"], host)).toThrow("must be an object");
});

test("Host Methods: validates log parameters", () => {
  const { methods } = createMethods(new Set(["log::write"]));

  expect(() => methods["log.write"].handle({
    "permission": "log::write",
    "level"     : "trace",
    "input"     : [],
  }, host)).toThrow("Invalid log parameters");
});

test("Host Methods: fetches only with the exact granted internet permission", async () => {
  const granted = "internet::http-get::https://example.com/a";
  const { methods, requests } = createMethods(new Set([granted]));

  await methods["internet.fetch"].handle({
    "permission": granted,
    "client"    : "web",
    "url"       : "https://example.com/a/b",
  }, host);

  expect(requests).toEqual([{
    "scope"      : "http-get",
    "argument"   : "https://example.com/a",
    "client"     : "web",
    "url"        : "https://example.com/a/b",
    "body"       : undefined,
    "contentType": undefined,
  }]);
  expect(() => methods["internet.fetch"].handle({
    "permission": "internet::http-get::https://example.com/",
    "client"    : "web",
    "url"       : "https://example.com/a/b",
  }, host)).toThrow("not granted");
  expect(() => methods["internet.fetch"].handle({
    "permission": granted,
    "client"    : "node",
    "url"       : "https://example.com/a/b",
  }, host)).toThrow("Invalid fetch parameters");
});
