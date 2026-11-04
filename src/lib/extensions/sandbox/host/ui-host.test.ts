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

import { SandboxLimitError } from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import { createDiv, mount, setup } from "@/lib/extensions/sandbox/host/ui-host.fixture.ts";

test("UI Host: mounts a child container and applies node operations", () => {
  const { ui, calls, sent } = setup();

  ui.apply({ "operations": [
    mount(),
    createDiv(3),
    { "handle": 3, "method": "setText", "input": ["hi"] },
    { "handle": 2, "method": "appendChild", "input": [{ "handle": 3 }] },
  ] });

  // Node 0 is the document, 1 the container, 2 the plugin root, 3 the new div
  expect(calls).toEqual([
    "0.getElement(container)",
    "0.createDiv()",
    "1.appendChild(node)",
    "0.createDiv()",
    "3.setText(hi)",
    "2.appendChild(node)",
  ]);
  expect(sent).toEqual([]);
});

test("UI Host: rejects unknown handles, including handles of another plugin", () => {
  const first = setup();
  const second = setup();

  first.ui.apply({ "operations": [mount(), createDiv(3)] });
  second.ui.apply({ "operations": [mount()] });

  expect(() => second.ui.apply({ "operations": [
    { "handle": 3, "method": "setText", "input": ["x"] },
  ] }))
    .toThrow("Unknown node handle 3");
  expect(() => second.ui.apply({ "operations": [
    { "handle": 2, "method": "appendChild", "input": [{ "handle": 3 }] },
  ] })).toThrow("not a node of this plugin");
  expect(() => second.ui.apply({ "operations": [
    { "handle": 1, "method": "createDiv", "input": [], "result": 2 },
  ] })).toThrow("already used");
});

test("UI Host: rejects methods outside the Ark surface", () => {
  const { ui, calls } = setup();

  ui.apply({ "operations": [mount()] });
  calls.length = 0;

  for (const method of ["getText", "toString", "constructor", "__proto__", "onClick", "setValue"]) {
    expect(() => ui.apply({ "operations": [{ "handle": 2, method, "input": [] }] }))
      .toThrow("Unknown method");
  }

  expect(() => ui.apply({ "operations": [
    { "handle": 1, "method": "createStyle", "input": [], "result": 3 },
  ] }))
    .toThrow("requires the 'ui::interactivity' permission");
  expect(() => ui.apply({ "operations": [{ "handle": 2, "method": "setText", "input": [{}] }] }))
    .toThrow("not a node of this plugin");
  expect(() => ui.apply({ "operations": ["setText", null, { "handle": "2" }] }))
    .toThrow("Rejected 3 UI operation(s)");
  expect(calls).toEqual([]);
});

test("UI Host: checks the UI grant at call time", () => {
  const grants = new Set(["ui::basic"]);
  const { ui } = setup({ grants });

  ui.apply({ "operations": [mount()] });
  grants.clear();

  expect(() => ui.apply({ "operations": [{ "handle": 2, "method": "setText", "input": ["x"] }] }))
    .toThrow("'ui::basic' permission is not granted");
  expect(() => setup({ "grants": (new Set) }).ui.apply({ "operations": [mount()] }))
    .toThrow("granted UI permission is required");
});

test("UI Host: corrects the mirror when Ark rejects a value", () => {
  const { ui, sent } = setup();

  ui.apply({ "operations": [
    mount(),
    { "handle": 2, "method": "setStyle", "input": ["color", "red"] },
    { "handle": 2, "method": "setStyle", "input": ["color", "url(https://example.com/x)"] },
    { "handle": 2, "method": "setData", "input": ["ok", "1"] },
    { "handle": 2, "method": "setData", "input": ["Not OK", "1"] },
  ] });

  expect(sent).toEqual([["ui.state", { "batch"  : 1, "updates": [
    { "handle": 2, "field": "style", "key": "color", "value": "red" },
    { "handle": 2, "field": "data", "key": "Not OK", "value": undefined },
  ] }]]);
});

test("UI Host: reports a missing mount element to the worker", () => {
  const { ui, sent } = setup();

  expect(() => ui.apply({ "operations": [
    { "handle": 1, "method": "mount", "input": ["missing", "ui::basic"], "result": 2 },
  ] })).toThrow("No HTML element with the 'missing' id was found");
  expect(sent).toEqual([["ui.failed", {
    "handle" : 1,
    "message": "No HTML element with the 'missing' id was found",
  }]]);
});

test("UI Host: applies listener options synchronously and forwards a snapshot", () => {
  const { ui, sent, fire } = setup();

  ui.apply({ "operations": [
    mount(),
    { "handle": 2, "method": "listen", "input": ["onClick", 1, { "preventDefault": true }] },
    { "handle": 2, "method": "listen", "input": ["onContextMenu", 2, { "stopPropagation": true }] },
  ] });

  const click = fire(2, "onClick", { "ctrlKey": true });
  const menu = fire(2, "onContextMenu");

  expect([click.prevented, click.stopped, menu.prevented, menu.stopped]).toEqual([1, 0, 0, 1]);
  expect(sent[0]).toEqual(["ui.event", { "listener": 1, "event"   : {
    "type"         : "onClick",
    "ctrlKey"      : true,
    "altKey"       : false,
    "shiftKey"     : false,
    "metaKey"      : false,
    "target"       : { "id": "", "value": undefined },
    "currentTarget": { "id": "", "value": undefined },
  } }]);
  expect(() => ui.apply({ "operations": [
    { "handle": 2, "method": "listen", "input": ["onClick", 1, {}] },
  ] })).toThrow("already used");
  expect(() => ui.apply({ "operations": [
    { "handle": 2, "method": "listen", "input": ["onChange", 3, {}] },
  ] })).toThrow("Unknown event");
});

test("UI Host: coalesces pointer moves to one event per frame", () => {
  const { ui, sent, fire, frames } = setup();

  ui.apply({ "operations": [
    mount(),
    { "handle": 2, "method": "listen", "input": ["onMouseMove", 1, {}] },
  ] });
  fire(2, "onMouseMove", { "shiftKey": false });
  fire(2, "onMouseMove", { "shiftKey": true });

  expect(sent).toEqual([]);
  expect(frames).toHaveLength(1);
  frames[0]();
  expect(sent).toHaveLength(1);
  expect((sent[0][1] as { "event": { "shiftKey": boolean } }).event.shiftKey).toBe(true);
});

test("UI Host: pushes input values before forwarding events", () => {
  const { ui, sent, fire, setValue } = setup();

  ui.apply({ "operations": [
    mount(),
    { "handle": 1, "method": "createInput", "input": [], "result": 3 },
    { "handle": 3, "method": "listen", "input": ["onInput", 1, {}] },
  ] });
  setValue(3, "typed");
  fire(3, "onInput");

  expect(sent.map(([method]) => method)).toEqual(["ui.state", "ui.event"]);
  expect(sent[0][1]).toEqual({ "batch"  : 1, "updates": [
    { "handle": 3, "field": "value", "key": undefined, "value": "typed" },
  ] });
});

test("UI Host: exceeding the node limit terminates the plugin", () => {
  const { ui } = setup({ "maxNodes": 2 });

  ui.apply({ "operations": [mount(), createDiv(3)] });

  expect(() => ui.apply({ "operations": [
    { "handle": 1, "method": "createDiv", "input": [], "result": 4 },
  ] })).toThrow(SandboxLimitError);
});

test("UI Host: a batch over the operation limit terminates the plugin before it is applied", () => {
  const { ui, calls, mounted } = setup({ "maxOperations": 10 });
  const operations: Array<unknown> = [mount(), ...Array.from({ "length": 10 })];

  expect(() => ui.apply({ operations })).toThrow(SandboxLimitError);
  expect([calls, mounted]).toEqual([[], []]);
});

test("UI Host: a rejected creation leaves no node behind", () => {
  const { ui, calls, mounted } = setup({ "maxNodes": 3 });

  ui.apply({ "operations": [
    mount(),
    { "handle": 1, "method": "createList", "input": ["unordered"], "result": 3 },
  ] });

  const before: Array<string> = [...calls];

  expect(() => ui.apply({ "operations": Array.from({ "length": 10 }, () => mount()) }))
    .toThrow("the first: The new node handle is invalid or already used");
  expect(() => ui.apply({ "operations": [
    { "handle": 1, "method": "mount", "input": ["app", "ui::basic"], "result": 1 },
    { "handle": 3, "method": "createItem", "input": [], "result": 3 },
    { "handle": 1, "method": "createStyle", "input": [], "result": 2 },
  ] })).toThrow("Rejected 3 UI operation(s)");
  expect([calls, mounted]).toEqual([before, ["app"]]);

  ui.apply({ "operations": [{ "handle": 3, "method": "createItem", "input": [], "result": 4 }] });
  calls.length = 0;

  expect(() => ui.apply({ "operations": [
    { "handle": 3, "method": "createItem", "input": [], "result": 5 },
  ] })).toThrow(SandboxLimitError);
  expect(calls).toEqual([]);

  const empty = setup({ "maxNodes": 0 });

  expect(() => empty.ui.apply({ "operations": [mount()] })).toThrow(SandboxLimitError);
  expect([empty.calls, empty.mounted]).toEqual([[], []]);
});

test("UI Host: removing a node releases its listeners and its place in the limit", () => {
  const { ui, calls } = setup({ "maxNodes": 2 });

  ui.apply({ "operations": [
    mount(),
    createDiv(3),
    { "handle": 3, "method": "listen", "input": ["onClick", 1, {}] },
    { "handle": 3, "method": "listen", "input": ["onMouseEnter", 2, {}] },
    { "handle": 2, "method": "listen", "input": ["onClick", 3, {}] },
    { "handle": 3, "method": "remove", "input": [] },
  ] });

  expect(calls.slice(-2)).toEqual(["3.cleanup.onClick", "3.cleanup.onMouseEnter"]);

  // The worker unsubscribes after the removal; the node is gone, the listener was released
  ui.apply({ "operations": [
    { "handle": 3, "method": "unlisten", "input": [1] },
    createDiv(4),
  ] });

  expect(() => ui.apply({ "operations": [{ "handle": 3, "method": "unlisten", "input": [3] }] }))
    .toThrow("Unknown listener");

  ui.dispose();

  expect(calls.filter(call => call.includes("cleanup"))).toEqual([
    "3.cleanup.onClick",
    "3.cleanup.onMouseEnter",
    "2.cleanup.onClick",
  ]);
});

test("UI Host: event target writes from the worker reach the element after dispatch", () => {
  const { ui, fire, getValue, elements } = setup();
  // Like Ark's event setter: any DOM 'value' is written, though Ark has no 'setValue' for an output
  const output = { "value": "" };
  const div = {};

  ui.apply({ "operations": [
    mount(),
    { "handle": 1, "method": "createInput", "input": [], "result": 3 },
    { "handle": 1, "method": "createOutput", "input": [], "result": 4 },
    createDiv(5),
    { "handle": 3, "method": "listen", "input": ["onInput", 1, {}] },
    { "handle": 4, "method": "listen", "input": ["onClick", 2, {}] },
    { "handle": 5, "method": "listen", "input": ["onClick", 3, {}] },
  ] });
  elements.set(4, output);
  elements.set(5, div);
  fire(3, "onInput");
  fire(4, "onClick");
  fire(5, "onClick");

  ui.apply({ "operations": [
    { "handle": 3, "method": "setEventTargetValue", "input": [1, "target", "target"] },
    { "handle": 4, "method": "setEventTargetValue", "input": [2, "currentTarget", 42] },
    { "handle": 5, "method": "setEventTargetValue", "input": [3, "currentTarget", "x"] },
  ] });
  expect([getValue(3), output.value, div]).toEqual(["target", "42", {}]);

  expect(() => ui.apply({ "operations": [
    { "handle": 4, "method": "setEventTargetValue", "input": [2, "currentTarget", {}] },
  ] })).toThrow("expected string, number, or boolean");
});

test("UI Host: dispose removes listeners and containers", () => {
  const { ui, calls } = setup();

  ui.apply({ "operations": [
    mount(),
    { "handle": 2, "method": "listen", "input": ["onClick", 1, {}] },
  ] });
  ui.dispose();

  expect(calls.slice(-2)).toEqual(["2.cleanup.onClick", "unmount"]);
});
