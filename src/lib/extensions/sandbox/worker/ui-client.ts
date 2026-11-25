/// <reference lib="es2021.weakref" />
import { isAttrKeySafe, type SafeDocument, validateFactory, validStyle } from "ark-of-atrahasis";

import { restrictUI } from "@/lib/shared/ui-scope.ts";

import type { ToWorker } from "./protocol.ts";
import { workerEvents } from "./ui-event.ts";
import { Factories, Methods } from "./ui-methods.ts";
import type { CheckedValues, EventOptions, Factory, Primitive, UIOp } from "./ui-protocol.ts";
import { WorkerRoots } from "./ui-roots.ts";
import { setterConversion } from "./ui-setters.ts";
import { detach, findNode, type Handler, move, type State, subtreeText } from "./ui-tree.ts";

type Kind = keyof typeof Methods;
const events = new Map(Object.values(Methods)
  .flatMap(methods => methods.split(" "))
  .filter(method => method.startsWith("on"))
  .map(method => [method.slice(2).toLowerCase(), method]));

type Client = {
  flush(): void;
  checked(values: CheckedValues, ackSeq: number): void;
  document(interactive: boolean, alias: string): SafeDocument;
  event(event: Extract<ToWorker, { "kind": "event" }>): unknown;
};

export function createUIClient(send: (ops: UIOp[], seq: number) => void): Client {
  let sequence = 0;
  let nextBatch = 1;
  let ops: UIOp[] = [];
  const states = new WeakMap<object, State>;
  const liveListeners = new Map<number, WeakRef<State>>;
  const orphaned = new FinalizationRegistry<number>(id => {
    liveListeners.delete(id);
    queue(["release", id]);
  });
  const roots = new WorkerRoots;
  const prototypes = new Map<Kind, object>;

  function flush(): void {
    if (ops.length > 0) {
      const batch = ops;

      ops = [];
      send(batch, nextBatch++);
    }
  }
  function queue(op: UIOp): number {
    if (ops.length === 0) {
      queueMicrotask(flush);
    }
    ops.push(op);

    return nextBatch;
  }
  function state(wrapper: object): State {
    const entry = states.get(wrapper);

    if (!entry) {
      throw new Error("Invalid or removed UI node");
    }

    return entry;
  }
  function release(root: State): void {
    detach(root);
    roots.moved(root);
    queue(["remove", root.id]);
    orphaned.unregister(root.wrapper);
    states.delete(root.wrapper);
    liveListeners.delete(root.id);
    root.events?.clear();
    for (const child of root.children ?? []) child.parent = undefined;
    root.children = undefined;
  }
  function create(kind: Kind): State {
    const wrapper = Object.freeze(Object.create(prototypes.get(kind)!)) as object;
    const node = { "id": ++sequence, wrapper };

    states.set(wrapper, node);
    orphaned.register(wrapper, node.id, wrapper);

    return node;
  }
  function factory(name: Factory, arguments_: Primitive[]): object {
    validateFactory(name, arguments_[0]);
    const kind = name === "createList" && arguments_[0] === "description"
      ? "SafeDescriptionListElement" : Factories[name];
    const node = create(kind);

    queue(["create", node.id, name, arguments_]);
    if ("setValue" in node.wrapper || name === "createData" || name === "createOutput" ||
      name === "createListItem") liveListeners.set(node.id, new WeakRef(node));
    if (name === "createInput" || name === "createSelect" || name === "createTextarea") {
      queue(["listen", node.id, name === "createSelect" ? "onChange" : "onInput", 0, {}]);
    }

    return node.wrapper;
  }
  function listen(
    wrapper: object, method: string, handler: Handler, options: EventOptions = {},
  ): () => void {
    const node = state(wrapper);
    const id = ++sequence;

    (node.events ??= new Map).set(id, handler);
    liveListeners.set(node.id, new WeakRef(node));
    queue(["listen", node.id, method, id, {
      "preventDefault"          : !!options.preventDefault,
      "stopPropagation"         : !!options.stopPropagation,
      "stopImmediatePropagation": !!options.stopImmediatePropagation,
    }]);

    return (): void => {
      if (node.events?.delete(id)) {
        queue(["unlisten", node.id, id]);
      }
    };
  }
  const base = Object.assign(Object.create(null), {
    appendChild(this: object, child: object) {
      move(roots, queue, "appendChild", state(this), states.get(child));
    },
    insertBefore(this: object, child: object, reference: object) {
      move(roots, queue, "insertBefore", state(this), states.get(child), states.get(reference));
    },
    replaceChild(this: object, child: object, reference: object) {
      move(roots, queue, "replaceChild", state(this), states.get(child), states.get(reference));
    },
    removeChild(this: object, child: object) {
      const node = states.get(child);

      if (!node) return;
      if (node.parent !== state(this)) {
        throw new DOMException("Node is not a child", "NotFoundError");
      }
      detach(node);
      roots.moved(node);
      queue(["removeChild", state(this).id, node.id]);
    },
    remove(this: object) {
      release(state(this));
    },
    addEventListener(
      this: Record<string, unknown>, event: string, function_: Handler, options: EventOptions,
    ) {
      const method = events.get(event);

      if (!method || !(method in this)) {
        throw new Error("Unsupported event");
      }

      return listen(this, method, function_, options);
    },
  });

  Object.defineProperty(base, "style", {
    get(this: object) {
      const node = state(this);

      return node.styles ??= new Proxy(Object.create(null), {
        set(target, key, value): boolean {
          if (typeof key !== "string") {
            return false;
          }
          const text = String(value ?? "");

          if (!validStyle(key, text)) return false;

          target[key] = text;
          queue(["style", state(node.wrapper).id, key, text]);

          return true;
        },
      });
    },
  });
  for (const [kind, methods] of Object.entries(Methods)) {
    const proto = kind === "SafeElement" ? base : Object.create(
      kind === "SafeTextNode" || kind === "SafeStyleSheet" ? null : base,
    );

    proto.remove = base.remove;
    for (const method of methods.split(" ")) {
      const property = method.slice(3);
      const attribute = property === "Data" || property === "Aria";
      const convert = setterConversion(kind as Kind, property);

      proto[method] = function (this: object, ...arguments_: Primitive[]): unknown {
        const node = state(this);

        if (method.startsWith("on")) {
          const handler = arguments_[0] as unknown as Handler;

          return listen(this, method, handler, arguments_[1] as EventOptions);
        }
        if (method.startsWith("create")) {
          const child = factory(method === "createItem" ? "createListItem" : method as Factory, []);

          move(roots, queue, "appendChild", node, state(child));

          return child;
        }
        const name = arguments_[0];

        if (attribute && (typeof name !== "string" || !isAttrKeySafe(name))) return;
        const key = attribute ? property + "/" + name : property;

        if (method.startsWith("get")) {
          if (property === "Text" && node.children?.length) {
            return subtreeText(node);
          }

          const initial = attribute ? undefined : (property === "Checked" ? false : "");

          return node.values?.get(key) ?? initial;
        }
        const value = convert(arguments_[attribute ? 1 : 0]);

        if (value === undefined) return;
        if (property === "Text") {
          while (node.children?.length) {
            const child = node.children.pop()!;

            child.parent = undefined;
            roots.moved(child);
          }
        }
        if (["Text", "Checked", "Value", "Class", "Id", "Data", "Aria", "CSS"].includes(property)) {
          (node.values ??= new Map).set(key, value);
          if (property === "Value") node.valueWriteSeq = nextBatch;
          if (property === "Checked") node.checkedWriteSeq = nextBatch;
        }
        queue(["set", node.id, method, attribute ? [name, value] : [value]]);
      };
    }
    prototypes.set(kind as Kind, proto);
  }
  for (const proto of prototypes.values()) {
    harden(proto);
  }

  return {
    flush, ...workerEvents(liveListeners, queue),
    document(interactive: boolean, alias: string): SafeDocument {
      if (typeof alias !== "string") {
        throw new TypeError("Expected root ID");
      }
      const root = roots.open(alias, () => {
        const node = create("SafeElement");

        (node.values ??= new Map).set("Id", alias);
        queue(["root", node.id, alias]);

        return node;
      });
      const gui = Object.create(null);

      for (const name of Object.keys(Factories) as Factory[]) {
        gui[name] = (...arguments_: Primitive[]): object => factory(name, arguments_);
      }
      gui.getElement = (id: string): object | null => findNode(root, id);

      return restrictUI(gui, interactive) as SafeDocument;
    },
  };
}
