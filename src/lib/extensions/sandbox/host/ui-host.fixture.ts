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

import type { SafeDocument } from "ark-of-atrahasis";

import { createUIHost } from "@/lib/extensions/sandbox/host/ui-host.ts";

export type FakeEventType = Record<string, unknown> & { "prevented": number; "stopped": number };

// A stand-in for Ark 0.3.1 that records calls and rejects what Ark rejects
export function createFakeArk(): {
  "createSafeDocument": (containerId: string) => SafeDocument;
  "calls"             : Array<string>;
  "fire"              : (
    node: number,
    event: string,
    extra?: Record<string, unknown>,
  ) => FakeEventType;
  "setValue"     : (node: number, value: string) => void;
  "getValue"     : (node: number) => string | undefined;
  // The DOM elements behind nodes, for the current target of 'fire'
  "elements"     : Map<number, Record<string, unknown>>;
  "currentTarget": () => object | null;
} {
  const calls: Array<string> = [];
  const elements = (new Map<number, Record<string, unknown>>);
  let current: object | null = null;
  const handlers = (new Map<string, Array<(event: unknown) => void>>);
  const values = (new Map<number, string>);
  let counter: number = 0;

  const createNode = (): Record<string, unknown> => {
    const id: number = counter++;
    const data = (new Map<string, string>);
    const styles: Record<string, string> = {};
    const style = new Proxy(styles, {
      "get": (_target, property: string): string => styles[property] ?? "",
      "set": (_target, property: string, value: unknown): boolean => {
        if (property === "background" || String(value).includes("url(")) {
          return false;
        }

        styles[property] = String(value);

        return true;
      },
    });

    return new Proxy({}, {
      "get": (_target, name: string | symbol): unknown => {
        if (name === "style") {
          return style;
        }

        if (typeof name !== "string" || name === "then") {
          return undefined;
        }

        switch (name) {
          case "getData": {
            return (key: string) => data.get(key);
          }
          case "setData": {
            return (key: string, value: unknown) => {
              if ((/^[a-z][a-z0-9-]*$/).test(key)) {
                data.set(key, String(value));
              }
            };
          }
          case "getValue": {
            return () => values.get(id) ?? "";
          }
          case "getChecked": {
            return () => false;
          }
          case "setValue": {
            return (value: unknown) => {
              calls.push(`${id}.setValue(${String(value)})`);
              values.set(id, String(value));
            };
          }
        }

        if (name.startsWith("on")) {
          return (handler: (event: unknown) => void) => {
            handlers.set(`${id}.${name}`, [...handlers.get(`${id}.${name}`) ?? [], handler]);

            return () => calls.push(`${id}.cleanup.${name}`);
          };
        }

        return (...input: Array<unknown>) => {
          calls.push(`${id}.${name}(${input.map(value => (
            typeof value === "object" ? "node" : String(value)
          )).join(",")})`);

          return name.startsWith("create") || name === "getElement" ? createNode() : undefined;
        };
      },
    });
  };

  return {
    calls,
    "createSafeDocument": (): SafeDocument => {
      counter = 0;

      return createNode() as unknown as SafeDocument;
    },
    "fire": (node, event, extra = {}): FakeEventType => {
      let dispatching: boolean = true;
      // Like Ark: 'currentTarget' is read from the native event, where it is 'null' after dispatch
      const createTarget = (current: boolean): Record<string, unknown> => ({
        "id": "",
        get "value"(): string | undefined {
          return values.get(node);
        },
        set "value"(input: string) {
          if (!current || dispatching) {
            values.set(node, String(input));
          }
        },
      });
      const native: FakeEventType = {
        "type"                    : event,
        "ctrlKey"                 : false,
        "altKey"                  : false,
        "shiftKey"                : false,
        "metaKey"                 : false,
        "target"                  : createTarget(false),
        "currentTarget"           : createTarget(true),
        "prevented"               : 0,
        "stopped"                 : 0,
        "preventDefault"          : () => native.prevented++,
        "stopPropagation"         : () => native.stopped++,
        "stopImmediatePropagation": () => {},
        ...extra,
      };

      current = elements.get(node) ?? null;

      for (const handler of handlers.get(`${node}.${event}`) ?? []) {
        handler(native);
      }

      dispatching = false;
      current = null;

      return native;
    },
    "setValue"     : (node, value) => values.set(node, value),
    "getValue"     : node => values.get(node),
    elements,
    "currentTarget": () => current,
  };
}

export function setup(options: {
  "maxNodes"     ?: number;
  "maxOperations"?: number;
  "grants"       ?: Set<string>;
} = {}): ReturnType<typeof createFakeArk> & {
  "ui"     : ReturnType<typeof createUIHost>;
  "sent"   : Array<[string, unknown]>;
  "frames" : Array<() => void>;
  "grants" : Set<string>;
  "mounted": Array<string>;
} {
  const ark = createFakeArk();
  const sent: Array<[string, unknown]> = [];
  const frames: Array<() => void> = [];
  const mounted: Array<string> = [];
  const grants = options.grants ?? new Set(["ui::basic", "ui::interactivity"]);
  let batch: number = 0;
  const host = createUIHost({
    "notify"       : (method, parameters) => sent.push([method, parameters]),
    "isGranted"    : permission => grants.has(permission),
    "maxNodes"     : options.maxNodes ?? 100,
    "maxOperations": options.maxOperations ?? 100,
    "environment"  : {
      "mount": elementId => {
        if (elementId === "missing") {
          return;
        }

        mounted.push(elementId);

        return { "containerId": "container", "unmount": (): number => ark.calls.push("unmount") };
      },
      "createSafeDocument": ark.createSafeDocument,
      "scheduleFrame"     : callback => frames.push(callback),
      "currentTarget"     : ark.currentTarget,
    },
  });

  // Numbers the batches like the worker does
  const ui: typeof host = {
    ...host,
    "apply": parameters => host.apply({ ...parameters as object, "batch": ++batch }),
  };

  return { ...ark, ui, sent, frames, grants, mounted };
}

export const createDiv = (result: number): unknown => (
  { "handle": 1, "method": "createDiv", "input": [], result }
);
export const mount = (permission: string = "ui::basic"): unknown => ({
  "handle": 1,
  "method": "mount",
  "input" : ["app", permission],
  "result": 2,
});
