import { throwIfAborted } from "@/lib/shared/abort.ts";

import type { Lifecycle } from "../lifecycle-hooks.ts";
import type { FromWorker, Reply, Request, ToWorker } from "./protocol.ts";

const lifecycleTimeoutMs = 10_000;

export class WorkerSession {
  readonly lifetime = new AbortController;
  private pending?: { "resolve": () => void; "reject": (error: Error) => void };
  private timer?  : ReturnType<typeof setTimeout>;
  private deadline = 0;
  private remaining = lifecycleTimeoutMs;
  private prompts = 0;
  private pauseForPrompts = true;

  constructor(
    private worker: Worker,
    private handle: (request: Request, signal: AbortSignal) => Promise<Reply | (() => Reply)>,
    private write: (message: Extract<FromWorker, { "kind": "log" | "event-error" }>) => void,
    private commit: (ops: import("./ui-protocol.ts").UIOp[], seq: number) => void,
  ) {
    const options = { "signal": this.lifetime.signal };

    worker.addEventListener("error", event => {
      this.dispose(new Error(event.message || "Worker failed"));
    }, options);
    worker.addEventListener("messageerror", () => {
      this.dispose(new Error("Unreadable Worker message"));
    }, options);
    worker.addEventListener("message", ({ data }: MessageEvent<FromWorker>) => {
      try {
        switch (data.kind) {
          case "release-body":
          case "request": {
            void this.respond(data);
            break;
          }
          case "ui": {
            this.commit(data.ops, data.seq);
            break;
          }
          case "event-error":
          case "log": {
            this.write(data);
            break;
          }
          case "failure": {
            this.dispose(new Error(data.error));
            break;
          }
          case "done": {
            clearTimeout(this.timer);
            this.pending?.resolve();
            this.pending = undefined;
            break;
          }
        }
      } catch (error) {
        this.dispose(new Error(String(error)));
      }
    }, options);
  }

  start(id: string, code: string, permissions: string[]): Promise<void> {
    return this.call({ "kind": "start", id, code, permissions });
  }

  lifecycle(method: Lifecycle): Promise<void> {
    return this.call({ "kind": "lifecycle", method });
  }

  dispose(error = new Error("Worker sandbox disposed")): void {
    if (this.lifetime.signal.aborted) {
      return;
    }
    clearTimeout(this.timer);
    this.worker.terminate();
    this.pending?.reject(error);
    this.pending = undefined;
    this.lifetime.abort(error);
  }

  private call(message: ToWorker): Promise<void> {
    return new Promise((resolve, reject) => {
      throwIfAborted(this.lifetime.signal);
      if (this.pending) {
        throw new Error("Concurrent Worker lifecycle calls");
      }
      this.pending = { resolve, reject };
      this.pauseForPrompts = message.kind === "start" ||
        (message.kind === "lifecycle" && message.method === "enable");
      this.remaining = lifecycleTimeoutMs;
      this.resume();
      try {
        this.worker.postMessage(message);
      } catch (error) {
        this.dispose(new Error(String(error)));
      }
    });
  }

  private resume(): void {
    if (!this.pending || (this.pauseForPrompts && this.prompts)) {
      return;
    }
    this.deadline = performance.now() + this.remaining;
    this.timer = setTimeout(() => {
      this.dispose(new Error("Worker lifecycle timed out"));
    }, this.remaining);
  }

  private async respond(
    message: Extract<FromWorker, { "kind": "request" | "release-body" }>,
  ): Promise<void> {
    const request = message.kind === "request" ? message.request : message;
    const prompt = request.kind === "permissions";
    const { signal } = this.lifetime;

    if (prompt && this.prompts++ === 0 && this.pending && this.pauseForPrompts) {
      clearTimeout(this.timer);
      this.remaining = Math.max(0, this.deadline - performance.now());
    }
    try {
      const reply = await this.handle(request, signal);

      if (!signal.aborted && message.kind === "request") {
        const { ticket } = message;
        const value = typeof reply === "function" ? reply() : reply;
        const transfer = value instanceof ArrayBuffer ? [value] : [];

        this.worker.postMessage({ "kind": "reply", ticket, value } satisfies ToWorker, transfer);
      }
    } catch (error) {
      if (!signal.aborted && message.kind === "request") {
        const { ticket } = message;
        const reply: ToWorker = { "kind": "reject", ticket, "error": String(error) };

        this.worker.postMessage(reply);
      }
    } finally {
      if (prompt && --this.prompts === 0 && this.pauseForPrompts) {
        this.resume();
      }
    }
  }
}
