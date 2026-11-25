import "ses";

import { handleTimePermission } from "@/lib/permissions/atomic/time.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";
import { buildSafeResponse } from "@/lib/permissions/safe-response.ts";

import { lifecycleHooks, type SandboxHooks } from "../lifecycle-hooks.ts";
import type {
  FetchResult, FromWorker, Level, Reply, Request, ToWorker,
} from "./protocol.ts";
import { createUIClient } from "./ui-client.ts";

const channel = self as unknown as {
  "postMessage": (message: FromWorker, transfer?: Transferable[]) => void;
  addEventListener(type: "message", function_: (event: MessageEvent<ToWorker>) => void): void;
};

lockdown();
const ui = createUIClient((ops, seq) => channel.postMessage({ "kind": "ui", ops, seq }));

type Pending = { "resolve": (value: Reply) => void; "reject": (error: Error) => void };
const pending = new Map<number, Pending>;
let sequence = 0;
let hooks: SandboxHooks;

function errorMessage(error: unknown): string {
  try {
    return String(error);
  } catch {
    return "Plugin threw an unprintable value";
  }
}

function request(input: Request, transfer?: Transferable[]): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const ticket = ++sequence;

    pending.set(ticket, { resolve, reject });
    try {
      channel.postMessage({ "kind": "request", ticket, "request": input }, transfer);
    } catch (error) {
      pending.delete(ticket);
      reject(error);
    }
  });
}

function capability(raw: string): unknown {
  const parsed = parsePermission(raw);

  if (!parsed) {
    throw new Error("Invalid permission");
  }
  switch (parsed.base) {
    case "time": { return handleTimePermission({ "id": "", "scope": parsed.scope }); }
    case "log": {
      if (parsed.scope === "read") {
        return (): Promise<Reply> => request({ "kind": "read-log" });
      }
      const bind = (level: Level) => (...messages: string[]): void => {
        channel.postMessage({ "kind": "log", level, "messages": messages.map(String) });
      };

      return {
        "debug": bind("debug"), "info": bind("info"), "warn": bind("warn"), "error": bind("error"),
      };
    }
    case "internet": {
      const bind = (transport: "tauriFetch" | "webFetch") => async (
        url: string, data?: ArrayBuffer | ArrayBufferView | string, contentType?: string,
      ): Promise<ReturnType<typeof buildSafeResponse>> => {
        // Transfer a private copy so the plugin retains ownership of its request body.
        const body = ArrayBuffer.isView(data)
          ? new Uint8Array(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer
          : (data instanceof ArrayBuffer ? new Uint8Array(new Uint8Array(data)).buffer : data);
        const result = await request({
          "kind": "fetch", "permission": raw, transport, url, body, contentType,
        }, body instanceof ArrayBuffer ? [body] : []) as FetchResult;
        const { handle, ...metadata } = result;

        if (handle === null) return buildSafeResponse(metadata, async () => new ArrayBuffer(0));

        return buildSafeResponse(metadata,
          async () => await request({ "kind": "read-body", handle }) as ArrayBuffer,
          () => channel.postMessage({ "kind": "release-body", "id": handle }));
      };

      return { "webFetch": bind("webFetch"), "tauriFetch": bind("tauriFetch") };
    }
    case "ui": {
      return (alias: string): ReturnType<typeof ui.document> => (
        ui.document(parsed.scope === "interactivity", alias)
      );
    }
  }
}

self.addEventListener("messageerror", () => {
  channel.postMessage({ "kind": "failure", "error": "Unreadable message in Worker sandbox" });
});

channel.addEventListener("message", async ({ data }) => {
  try {
    switch (data.kind) {
      case "checked": {
        ui.checked(data.values, data.ackSeq);

        return;
      }
      case "event": {
        try {
          await ui.event(data);
        } catch (error) {
          channel.postMessage({ "kind": "event-error", "error": errorMessage(error) });
        }

        return;
      }
      case "reply":
      case "reject": {
        const entry = pending.get(data.ticket);

        pending.delete(data.ticket);
        if (data.kind === "reply") {
          entry?.resolve(data.value);
        } else {
          entry?.reject(new Error(data.error));
        }

        return;
      }
      case "start": {
        const scopedThis = Object.fromEntries(data.permissions.map(raw => [raw, capability(raw)]));
        const requestPermissions = async (input: string[]): Promise<unknown[]> => {
          const grants = await request({ "kind": "permissions", input }) as Array<string | false>;

          return harden(grants.map(raw => raw && capability(raw)));
        };
        const compartment = new Compartment({
          "globals": harden({ scopedThis, requestPermissions }), "__options__": true,
        });

        hooks = lifecycleHooks(compartment.evaluate(data.code));
        break;
      }
      case "lifecycle": {
        await hooks[data.method]();
        break;
      }
    }
    ui.flush();
    channel.postMessage({ "kind": "done" });
  } catch (error) {
    channel.postMessage({ "kind": "failure", "error": errorMessage(error) });
  }
});
