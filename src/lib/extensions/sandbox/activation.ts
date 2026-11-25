import { activationAbortReason, throwIfAborted } from "@/lib/shared/abort.ts";

const teardownTimeoutMs = 10_000;

type Hooks = { disable(): void | Promise<void>; afterDisable(): void | Promise<void> };

export class SandboxActivation {
  readonly lifetime = new AbortController;
  phase: "starting" | "active" | "stopping" | "cancelled" = "starting";

  constructor(public engine: "ses" | "worker") {}

  cancelPending(): void {
    if (this.phase === "active") return;
    this.phase = "cancelled";
    this.lifetime.abort();
  }

  async wait(operation: () => void | Promise<void>): Promise<void> {
    const { signal } = this.lifetime;

    throwIfAborted(signal);
    let abort!: () => void;
    const cancellation = new Promise<never>((_, reject) => {
      abort = (): void => reject(activationAbortReason(signal));
      signal.addEventListener("abort", abort, { "once": true });
    });

    try {
      await Promise.race([cancellation, Promise.resolve().then(() => {
        throwIfAborted(signal);

        return operation();
      })]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  async stop(hooks: Hooks, afterDisable: boolean): Promise<void> {
    this.phase = "stopping";
    const timeout = setTimeout(() => {
      this.lifetime.abort(new Error("Sandbox teardown timed out"));
    }, teardownTimeoutMs);

    try {
      await this.wait(() => hooks.disable());
      if (afterDisable) await this.wait(() => hooks.afterDisable());
    } finally {
      clearTimeout(timeout);
      this.lifetime.abort();
    }
  }
}
