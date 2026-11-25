import type { SafeEvent } from "ark-of-atrahasis";

import type { Primitive, UIOp } from "./ui-protocol.ts";
import type { WorkerRoots } from "./ui-roots.ts";

export type Handler = (event: SafeEvent) => void;
export type State = {
  "id"              : number;
  "wrapper"         : object;
  "alias"?          : string;
  "hasAliases"?     : boolean;
  "parent"?         : State;
  "children"?       : State[];
  "values"?         : Map<string, Primitive>;
  "styles"?         : Record<string, string>;
  "valueWriteSeq"?  : number;
  "checkedWriteSeq"?: number;
  "events"?         : Map<number, Handler>;
};

export function detach(node: State): void {
  const children = node.parent?.children;

  if (children) {
    children.splice(children.indexOf(node), 1);
  }
  node.parent = undefined;
}
export function move(
  roots: WorkerRoots, queue: (op: UIOp) => void,
  kind: "appendChild" | "insertBefore" | "replaceChild",
  node: State,
  child: State | undefined, reference?: State,
): void {
  if (!child || (kind !== "appendChild" && !reference)) return;
  if (!("appendChild" in node.wrapper)) throw new TypeError("Invalid tree receiver");
  if (reference && reference.parent !== node) {
    throw new DOMException("Reference must belong to this parent", "NotFoundError");
  }
  if (child === reference) {
    return;
  }
  for (let ancestor: State | undefined = node; ancestor; ancestor = ancestor.parent) {
    if (ancestor === child) {
      throw new DOMException("Cyclic UI tree", "HierarchyRequestError");
    }
  }
  detach(child);
  const children = node.children ??= [];

  if (kind === "appendChild") {
    children.push(child);
    queue([kind, node.id, child.id]);
  } else {
    children.splice(children.indexOf(reference!), kind === "replaceChild" ? 1 : 0, child);
    queue([kind, node.id, child.id, reference!.id]);
    if (kind === "replaceChild") {
      reference!.parent = undefined;
      roots.moved(reference!);
    }
  }
  child.parent = node;
  roots.moved(child);
}

export function subtreeText(node: State): string {
  const stack = [node];
  const text: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop()!;

    text.push(String(current.values?.get("Text") ?? ""));
    const children = current.children ?? [];

    for (let index = children.length - 1; index >= 0; index--) {
      stack.push(children[index]);
    }
  }

  return text.join("");
}

export function findNode(root: State, id: string): object | null {
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;

    if (node.values?.get("Id") === id) {
      return node.wrapper;
    }
    const children = node.children ?? [];

    for (let index = children.length - 1; index >= 0; index--) {
      stack.push(children[index]);
    }
  }

  return null;
}
