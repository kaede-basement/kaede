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

import type { ArkKindType, ArkStateType } from "@/lib/extensions/sandbox/ark-surface.ts";
import type { UIStateType } from "@/lib/extensions/sandbox/protocol.ts";

/*
 * The worker-side copy of a plugin's UI tree. Getters read it synchronously,
 * mirroring how Ark would read the real DOM node.
 */

export type MirrorDocumentType = {
  "handle"   : number;
  // The ID the plugin passed to 'createSafeDocument'; 'getElement' returns the root for it
  "elementId": string;
  "root"     : MirrorNodeType | undefined;
  // The launcher could not mount the document; every later call throws this message
  "failed"   : string | undefined;
};

export type MirrorNodeType = {
  "handle"  : number;
  "kind"    : ArkKindType;
  "document": MirrorDocumentType;
  "parent"  : MirrorNodeType | undefined;
  // Strings are text set with 'setText'
  "children": Array<MirrorNodeType | string>;
  // Ark unregisters a removed node, so it can no longer be attached anywhere
  "removed" : boolean;
  "text"    : string;
  "class"   : string;
  "id"      : string;
  "css"     : string;
  "value"   : string;
  "checked" : boolean;
  "data"    : Map<string, string | undefined>;
  "aria"    : Map<string, string | undefined>;
  "style"   : Map<string, string | undefined>;
  // The batch of the latest plugin write to each state field
  "written" : Map<string, number>;
};

export function createMirrorNode(
  handle: number,
  kind: ArkKindType,
  document: MirrorDocumentType,
): MirrorNodeType {
  return {
    handle,
    kind,
    document,
    "parent"  : undefined,
    "children": [],
    "removed" : false,
    "text"    : "",
    "class"   : "",
    "id"      : "",
    "css"     : "",
    "value"   : "",
    "checked" : false,
    "data"    : new Map,
    "aria"    : new Map,
    "style"   : new Map,
    "written" : new Map,
  };
}

export function getTextContent(node: MirrorNodeType): string {
  if (node.kind === "text") {
    return node.text;
  }

  return node.children
    .map(child => (typeof child === "string" ? child : getTextContent(child)))
    .join("");
}

function contains(ancestor: MirrorNodeType, node: MirrorNodeType): boolean {
  for (let current: MirrorNodeType | undefined = node; current; current = current.parent) {
    if (current === ancestor) {
      return true;
    }
  }

  return false;
}

function detach(node: MirrorNodeType): void {
  if (node.parent !== undefined) {
    node.parent.children = node.parent.children.filter(child => child !== node);
    node.parent = undefined;
  }
}

// The DOM throws for these cases, so Ark leaves the tree unchanged
function canInsert(parent: MirrorNodeType, child: MirrorNodeType | undefined): boolean {
  return child !== undefined && !child.removed && !contains(child, parent);
}

/**
 * Applies a tree-changing Ark call to the mirror.
 *
 * @param node - the node the method was called on
 * @param method - the Ark method
 * @param nodes - node arguments, 'undefined' for anything that is not a live node
 */
export function applyTreeChange(
  node: MirrorNodeType,
  method: string,
  nodes: Array<MirrorNodeType | undefined>,
): void {
  const [first, second] = nodes;

  switch (method) {
    case "appendChild": {
      if (canInsert(node, first)) {
        detach(first as MirrorNodeType);
        node.children.push(first as MirrorNodeType);
        (first as MirrorNodeType).parent = node;
      }

      return;
    }
    case "insertBefore":
    case "replaceChild": {
      if (!canInsert(node, first) || second === undefined || second.parent !== node) {
        return;
      }

      detach(first as MirrorNodeType);

      const index: number = node.children.indexOf(second);

      node.children.splice(index, method === "replaceChild" ? 1 : 0, first as MirrorNodeType);
      (first as MirrorNodeType).parent = node;

      if (method === "replaceChild") {
        second.parent = undefined;
      }

      return;
    }
    case "removeChild": {
      if (first?.parent === node) {
        detach(first);
      }

      return;
    }
    case "remove": {
      detach(node);
      node.removed = true;

      return;
    }
  }
}

function getStateKey({ field, key }: ArkStateType): string {
  return `${field}:${key ?? ""}`;
}

function applyState(node: MirrorNodeType, { field, key, value }: ArkStateType): void {
  switch (field) {
    case "text": {
      if (node.kind === "text") {
        node.text = String(value);

        return;
      }

      for (const child of node.children) {
        if (typeof child !== "string") {
          child.parent = undefined;
        }
      }

      node.children = value === "" ? [] : [String(value)];

      return;
    }
    case "data":
    case "aria":
    case "style": {
      node[field].set(String(key), value === undefined ? undefined : String(value));

      return;
    }
    case "checked": {
      node.checked = Boolean(value);

      return;
    }
    default: {
      node[field] = String(value);
    }
  }
}

export function writeState(node: MirrorNodeType, state: ArkStateType, batch: number): void {
  applyState(node, state);
  node.written.set(getStateKey(state), batch);
}

/*
 * A field the plugin wrote in a batch after 'batch' keeps its value: the launcher
 * reports on that write once it applies it
 */
export function applyUpdates(
  nodes: ReadonlyMap<number, MirrorNodeType>,
  { batch, updates }: UIStateType,
): void {
  for (const update of updates) {
    const node: MirrorNodeType | undefined = nodes.get(update.handle);

    if (node !== undefined && (node.written.get(getStateKey(update)) ?? 0) <= batch) {
      applyState(node, update);
    }
  }
}

// Ark searches the plugin root and its descendants by the 'id' attribute
export function findById(document: MirrorDocumentType, id: string): MirrorNodeType | undefined {
  if (document.root === undefined) {
    return undefined;
  }

  if (id === document.elementId) {
    return document.root;
  }

  const stack: Array<MirrorNodeType> = [document.root];

  while (stack.length > 0) {
    const current = stack.pop() as MirrorNodeType;

    if (current.id === id) {
      return current;
    }

    // Reversed, so the search visits nodes in document order like 'querySelector'
    for (const child of [...current.children].reverse()) {
      if (typeof child !== "string") {
        stack.push(child);
      }
    }
  }

  return undefined;
}
