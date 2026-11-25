import { getRealNode, type SafeDocument, type SafeElement } from "ark-of-atrahasis";

import type { ExtensionUI } from "../ui-root.ts";
import { InteractiveFactories } from "../ui-scope.ts";
import { FormControls } from "./form-controls.ts";
import type { ToWorker } from "./protocol.ts";
import { Factories } from "./ui-methods.ts";
import type { UIOp } from "./ui-protocol.ts";

type Wrapper = SafeElement & Record<string, (...arguments_: never[]) => unknown>;
const interactive = new Set<string>(InteractiveFactories);

export class WorkerUIHost {
  private ackSeq = 0;
  private controls = new FormControls;
  private nodes = new Map<number, Wrapper>;
  private listeners = new Map<number, Map<number, () => void>>;
  private gui?: SafeDocument;

  constructor(
    private roots: ExtensionUI, private grants: Set<string>,
    private send: (event: Extract<ToWorker, { "kind": "event" | "checked" }>) => void,
  ) {}

  commit(ops: UIOp[], seq: number): void {
    if (!this.grants.has("ui::basic") && !this.grants.has("ui::interactivity")) {
      throw new Error("Missing UI permission");
    }
    for (const op of ops) {
      const [kind, id] = op;

      if (kind === "root") {
        const gui = this.roots.document(op[2], id);

        this.nodes.set(id, gui.getElement(op[2]) as Wrapper);
        continue;
      }
      if (kind === "create") {
        const factory = op[2];
        const arguments_ = op[3];

        if (!Object.prototype.hasOwnProperty.call(Factories, factory) ||
          (interactive.has(factory) && !this.grants.has("ui::interactivity"))) {
          throw new Error("Unavailable UI factory");
        }
        this.gui ??= this.roots.factories();
        const create = this.gui[factory] as (...arguments__: never[]) => unknown;

        const wrapper = create(...arguments_ as never[]) as Wrapper;

        this.nodes.set(id, wrapper);
        this.controls.register(getRealNode(wrapper) as Element, id);
        continue;
      }
      const node = this.nodes.get(id)!;

      switch (kind) {
        case "set": {
          const method = op[2];

          if (!method.startsWith("set") || !Object.prototype.hasOwnProperty.call(node, method)) {
            throw new Error("Invalid UI setter");
          }
          const changesGroup = method === "setName" || method === "setType";
          const element = changesGroup ? getRealNode(node) as Element : undefined;

          if (element) this.controls.group(element, false);
          node[method](...op[3] as never[]);
          if (element) this.controls.group(element, true);
          if (changesGroup || method === "setChecked") {
            this.controls.changed(element ?? getRealNode(node) as Element);
          }
          break;
        }
        case "event-value": {
          const element = node && getRealNode(node);

          if (element && "value" in element) element.value = op[2];
          break;
        }
        case "style": {
          node.style[op[2]] = op[3];
          break;
        }
        case "appendChild":
        case "removeChild": {
          const child = this.nodes.get(op[2])!;

          node[kind](child);
          if (kind === "appendChild") this.controls.inserted(getRealNode(child) as Element);
          break;
        }
        case "replaceChild":
        case "insertBefore": {
          const child = this.nodes.get(op[2])!;

          node[kind](child, this.nodes.get(op[3])!);
          this.controls.inserted(getRealNode(child) as Element);
          break;
        }
        case "release":
        case "remove": {
          this.controls.forget(getRealNode(node) as Element);
          if (kind === "remove") {
            node.remove();
          }
          for (const cleanup of this.listeners.get(id)?.values() ?? []) {
            cleanup();
          }
          this.listeners.delete(id);
          this.nodes.delete(id);
          break;
        }
        case "unlisten": {
          this.listeners.get(id)?.get(op[2])?.();
          this.listeners.get(id)?.delete(op[2]);
          break;
        }
        case "listen": {
          const method = op[2];
          const listener = op[3];
          const options = op[4];

          if (!method.startsWith("on") || !Object.prototype.hasOwnProperty.call(node, method)) {
            throw new Error("Invalid UI listener");
          }
          const element = getRealNode(node) as Element;
          const type = method.slice(2).toLowerCase();
          const handle = (event: Event): void => {
            if (options.preventDefault) event.preventDefault();
            if (options.stopPropagation) event.stopPropagation();
            if (options.stopImmediatePropagation) event.stopImmediatePropagation();
            const target = event.target as Element;
            const keys = event as MouseEvent;
            const changesChecked = type === "click" || type === "input" || type === "change";
            const checked = changesChecked ? this.controls.checked(target) : undefined;

            this.send({
              "kind"    : "event",
              "node"    : id,
              "ackSeq"  : this.ackSeq,
              listener,
              checked,
              "snapshot": {
                type,
                "ctrlKey"      : !!keys.ctrlKey,
                "altKey"       : !!keys.altKey,
                "shiftKey"     : !!keys.shiftKey,
                "metaKey"      : !!keys.metaKey,
                "target"       : this.controls.target(target),
                "currentTarget": this.controls.target(element),
              },
            });
            if (checked && type === "click" && options.preventDefault) {
              // Native checkable activation is rolled back after every listener returns.
              setTimeout(() => {
                const values = this.controls.checked(target);

                if (values) this.send({ "kind": "checked", values, "ackSeq": this.ackSeq });
              }, 0);
            }
          };

          element.addEventListener(type, handle);
          const cleanup = (): void => element.removeEventListener(type, handle);
          let listeners = this.listeners.get(id);

          if (!listeners) {
            listeners = new Map;
            this.listeners.set(id, listeners);
          }
          listeners.set(listener, cleanup);
          break;
        }
      }
    }
    this.ackSeq = seq;
    const values = this.controls.reconcile();

    if (values.length > 0) this.send({ "kind": "checked", values, "ackSeq": seq });
  }

  dispose(): void {
    for (const listeners of this.listeners.values()) {
      for (const cleanup of listeners.values()) {
        cleanup();
      }
    }
    this.listeners.clear();
    this.nodes.clear();
    this.controls = new FormControls;
    this.gui = undefined;
  }
}
