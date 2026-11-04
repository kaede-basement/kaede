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

import { createSafeDocument } from "ark-of-atrahasis";
import { afterEach, expect, test } from "bun:test";

import { SandboxLimits } from "@/constants/sandbox.ts";
import { createUIHost } from "@/lib/extensions/sandbox/host/ui-host.ts";
import { createUIStubs } from "@/lib/extensions/sandbox/worker/ark-proxy.ts";
import type { WorkerRpcType } from "@/lib/extensions/sandbox/worker/worker-rpc.ts";

type AnyNodeType = Record<string, (...input: Array<unknown>) => unknown>;

// The part of an element that real Ark touches here, with the value sanitizing of number inputs
class FakeElement {
  public readonly style   : Record<string, string> = {};
  public readonly children: Array<FakeElement> = [];
  public checked          : boolean = false;
  private readonly attributes = (new Map<string, string>);
  private current         : string = "";

  public get id(): string {
    return this.getAttribute("id") ?? "";
  }

  public get value(): string {
    return this.current;
  }

  public set value(input: string) {
    const invalid: boolean = this.getAttribute("type") === "number" && Number.isNaN(Number(input));

    this.current = invalid ? "" : input;
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  public addEventListener(): void {}
}

const realDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

afterEach(() => {
  if (realDocument === undefined) {
    Reflect.deleteProperty(globalThis, "document");
  } else {
    Object.defineProperty(globalThis, "document", realDocument);
  }
});

test("UI round trip: an update for an earlier batch keeps a value written in a later one", () => {
  const container = new FakeElement;
  const elements: Array<FakeElement> = [];

  container.setAttribute("id", "container");
  Reflect.set(globalThis, "document", {
    "getElementById": (id: string) => (id === "container" ? container : null),
    "createElement" : () => {
      const element = new FakeElement;

      elements.push(element);

      return element;
    },
  });

  const batches: Array<unknown> = [];
  const states: Array<unknown> = [];
  const workerHandlers = (new Map<string, (parameters: unknown) => void>);
  const microtasks: Array<() => void> = [];
  const rpc = {
    "notify": (method: string, parameters: unknown) => {
      if (method === "ui.ops") {
        batches.push(parameters);
      }
    },
    "onNotification": (method: string, handler: (parameters: unknown) => void) => {
      workerHandlers.set(method, handler);
    },
  } as unknown as WorkerRpcType;
  const host = createUIHost({
    "notify": (method, parameters) => {
      if (method === "ui.state") {
        states.push(parameters);
      }
    },
    "isGranted"    : () => true,
    "maxNodes"     : 100,
    "maxOperations": SandboxLimits.UIOperations,
    "environment"  : {
      "mount"        : () => ({ "containerId": "container", "unmount": (): void => {} }),
      createSafeDocument,
      "scheduleFrame": () => {},
      "currentTarget": () => null,
    },
  });

  const document = createUIStubs(rpc, callback => microtasks.push(callback))("ui::basic")(
    "app",
  ) as AnyNodeType;
  const late = document.createInput() as AnyNodeType;
  const early = document.createInput() as AnyNodeType;

  late.setType("number");
  early.setType("number");
  late.setValue("bad");
  early.setValue("bad");

  // The mount and the six calls above are the first operations of the first batch
  for (let index = 7; index < SandboxLimits.UIOperations; index++) {
    late.setPlaceholder(String(index));
  }

  late.setValue("42");

  for (const callback of microtasks.splice(0)) callback();

  expect(batches).toHaveLength(2);

  for (const batch of batches) {
    host.apply(batch);
  }

  for (const state of states) {
    workerHandlers.get("ui.state")?.(state);
  }

  // Element 0 is the plugin root
  expect([late.getValue(), early.getValue()]).toEqual([elements[1].value, elements[2].value]);
  expect([late.getValue(), early.getValue()]).toEqual(["42", ""]);
});
