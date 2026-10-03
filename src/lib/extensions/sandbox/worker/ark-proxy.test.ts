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

/* eslint-disable unicorn/prefer-dom-node-append -- Ark nodes are not DOM nodes */

import { expect, test } from "bun:test";

import { SandboxLimits } from "@/constants/sandbox.ts";
import type { UIOperationType } from "@/lib/extensions/sandbox/protocol.ts";
import { createUIStubs } from "@/lib/extensions/sandbox/worker/ark-proxy.ts";
import type { WorkerRpcType } from "@/lib/extensions/sandbox/worker/worker-rpc.ts";

type AnyNodeType = Record<string, (...input: Array<unknown>) => unknown> & {
  "style": Record<string, string>;
};

function setup(permission: string = "ui::basic"): {
  "document": AnyNodeType;
  "batches" : Array<Array<UIOperationType>>;
  "deliver" : (method: string, parameters: unknown) => void;
  "flush"   : () => void;
} {
  const batches: Array<Array<UIOperationType>> = [];
  const notifications = (new Map<string, (parameters: unknown) => void>);
  const microtasks: Array<() => void> = [];
  const rpc = {
    "notify": (method: string, parameters: unknown) => {
      if (method === "ui.ops") {
        batches.push((parameters as { "operations": Array<UIOperationType> }).operations);
      }
    },
    "onNotification": (method: string, handler: (parameters: unknown) => void) => {
      notifications.set(method, handler);
    },
  } as unknown as WorkerRpcType;
  const document = createUIStubs(rpc, callback => microtasks.push(callback))(permission)("app");

  return {
    "document": document as AnyNodeType,
    batches,
    "deliver" : (method, parameters) => notifications.get(method)?.(parameters),
    "flush"   : (): void => {
      for (const callback of microtasks.splice(0)) callback();
    },
  };
}

test("Ark Proxy: batches the calls of one tick into one message", () => {
  const { document, batches, flush } = setup();
  const root = document.getElement("app") as AnyNodeType;
  const title = document.createHeading(2) as AnyNodeType;

  title.setText("Hello");
  root.appendChild(title);
  root.style.color = "red";
  flush();

  expect(batches).toEqual([[
    { "handle": 1, "method": "mount", "input": ["app", "ui::basic"], "result": 2 },
    { "handle": 1, "method": "createHeading", "input": [2], "result": 3 },
    { "handle": 3, "method": "setText", "input": ["Hello"] },
    { "handle": 2, "method": "appendChild", "input": [{ "handle": 3 }] },
    { "handle": 2, "method": "setStyle", "input": ["color", "red"] },
  ]]);
});

test("Ark Proxy: splits a tick with more calls than the launcher accepts in one batch", () => {
  const { document, batches, flush } = setup();
  const root = document.getElement("app") as AnyNodeType;

  // The mount is the first operation
  for (let index = 0; index < SandboxLimits.UIOperations; index++) {
    root.setText(String(index));
  }

  flush();

  expect(batches.map(batch => batch.length)).toEqual([SandboxLimits.UIOperations, 1]);
  expect(batches[1]).toEqual([{
    "handle": 2,
    "method": "setText",
    "input" : [String(SandboxLimits.UIOperations - 1)],
  }]);
});

test("Ark Proxy: answers getters from the mirror", () => {
  const { document } = setup();
  const root = document.getElement("app") as AnyNodeType;
  const first = document.createDiv() as AnyNodeType;
  const second = document.createSpan() as AnyNodeType;

  first.setText("a");
  second.setText("b");
  second.setId("inner");
  root.appendChild(first);
  first.appendChild(second);

  expect(root.getText()).toBe("ab");
  expect(document.getElement("inner")).toBe(second);
  expect(document.getElement("launcher-element")).toBeNull();

  root.setText("reset");

  expect(root.getText()).toBe("reset");
  expect(document.getElement("inner")).toBeNull();
  expect(root.getId()).toBe("app");
  expect(() => document.createHeading(7)).toThrow("Heading level must be 1-6");
  expect(document.createStyle).toBeUndefined();
  expect(setup("ui::interactivity").document.createStyle).toBeFunction();
});

test("Ark Proxy: applies corrections and value updates from the launcher", () => {
  const { document, deliver } = setup();
  const root = document.getElement("app") as AnyNodeType;
  const input = document.createInput() as AnyNodeType;

  root.style.background = "url(x)";
  expect(root.style.background).toBe("url(x)");

  deliver("ui.state", { "batch"  : 1, "updates": [
    { "handle": 2, "field": "style", "key": "background", "value": undefined },
    { "handle": 3, "field": "value", "key": undefined, "value": "typed" },
  ] });

  expect(root.style.background).toBeUndefined();
  expect(input.getValue()).toBe("typed");
});

test("Ark Proxy: a failed mount makes later calls throw", () => {
  const { document, deliver } = setup();

  deliver("ui.failed", { "handle": 1, "message": "No HTML element with the 'app' id was found" });

  expect(() => document.createDiv()).toThrow("No HTML element with the 'app' id was found");
});

test("Ark Proxy: delivers events and turns target value writes into operations", () => {
  const { document, batches, deliver, flush } = setup();
  const input = document.createInput() as AnyNodeType;
  const seen: Array<unknown> = [];

  input.onInput((event: { "target": { "value": unknown } }) => {
    seen.push(event.target.value);
    event.target.value = "changed";
  }, { "preventDefault": 1 });
  flush();
  deliver("ui.event", { "listener": 1, "event"   : {
    "type"         : "input",
    "ctrlKey"      : false,
    "altKey"       : false,
    "shiftKey"     : false,
    "metaKey"      : false,
    "target"       : { "id": "", "value": "typed" },
    "currentTarget": { "id": "", "value": "typed" },
  } });
  flush();

  expect(seen).toEqual(["typed"]);
  expect(batches[0][2]).toEqual({
    "handle": 3,
    "method": "listen",
    "input" : ["onInput", 1, {
      "preventDefault"          : true,
      "stopPropagation"         : false,
      "stopImmediatePropagation": false,
    }],
  });
  expect(batches[1]).toEqual([
    { "handle": 3, "method": "setEventTargetValue", "input": [1, "target", "changed"] },
  ]);
});
