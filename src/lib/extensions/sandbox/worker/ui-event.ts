import { assertPrimitiveInput } from "ark-of-atrahasis";

import type { ToWorker } from "./protocol.ts";
import type { CheckedValues, TargetSnapshot, UIOp } from "./ui-protocol.ts";
import type { State } from "./ui-tree.ts";

function late(): never {
  throw new Error("Dispatch finished. Use declarative listener options or SES to cancel an event.");
}

type WorkerEvent = Extract<ToWorker, { "kind": "event" }>;

export function workerEvents(
  liveListeners: Map<number, WeakRef<State>>, queue: (op: UIOp) => number,
): { checked(values: CheckedValues, ackSeq: number): void; event(event: WorkerEvent): unknown } {
  function checked(values: CheckedValues, ackSeq: number): void {
    for (const [handle, value] of values) {
      const control = liveListeners.get(handle)?.deref();

      if (control && (control.checkedWriteSeq ?? 0) <= ackSeq) {
        (control.values ??= new Map).set("Checked", value);
      }
    }
  }
  function target(snapshot: TargetSnapshot, ackSeq: number): TargetSnapshot {
    let value = snapshot.value;
    const handle = snapshot.node;
    const control = handle === undefined ? undefined : liveListeners.get(handle)?.deref();

    if (control && (control.valueWriteSeq ?? 0) <= ackSeq && typeof value === "string") {
      (control.values ??= new Map).set("Value", value);
    }

    return {
      "id": snapshot.id,
      get "value"(): unknown {
        if (control && (control.valueWriteSeq ?? 0) > ackSeq) return control.values?.get("Value");

        return value;
      },
      set "value"(input: unknown) {
        assertPrimitiveInput(input);
        if (handle === undefined) return;
        const submitted = String(input);

        value = submitted;
        const seq = queue(["event-value", handle, submitted]);

        if (control) {
          (control.values ??= new Map).set("Value", submitted);
          control.valueWriteSeq = seq;
        }
      },
    };
  }

  return {
    checked,
    event(event: WorkerEvent): unknown {
      const node = liveListeners.get(event.node)?.deref();

      if (!node) {
        return;
      }
      if (event.checked) checked(event.checked, event.ackSeq);
      const subject = target(event.snapshot.target, event.ackSeq);
      const current = event.snapshot.currentTarget;
      const same = current.node !== undefined && current.node === event.snapshot.target.node;
      const currentTarget = same ? subject : target(current, event.ackSeq);

      return node.events?.get(event.listener)?.(harden({
        ...event.snapshot,
        "target"                  : subject,
        currentTarget,
        "preventDefault"          : late,
        "stopPropagation"         : late,
        "stopImmediatePropagation": late,
      }));
    },
  };
}
