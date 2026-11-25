import { WorkerSession } from "./session.ts";

export function supportsWorkerSandbox(): boolean {
  return typeof Worker === "function" && typeof WeakRef === "function" &&
    typeof FinalizationRegistry === "function" && typeof queueMicrotask === "function" &&
    typeof AbortController === "function";
}

export function createSandboxWorker(): Worker {
  return new Worker(new URL("runtime.ts", import.meta.url), { "type": "module" });
}

let readiness: Promise<boolean> | undefined;

export async function canStartWorkerSandbox(): Promise<boolean> {
  if (!supportsWorkerSandbox()) return false;
  // Module support and worker-src policy also determine whether this bundle can execute.
  readiness ??= (async (): Promise<boolean> => {
    const probe = new WorkerSession(createSandboxWorker(), async () => "", () => {}, () => {});

    try {
      await probe.start("launcher", "({})", []);

      return true;
    } finally {
      probe.dispose();
    }
  })().catch(() => {
    readiness = undefined;

    return false;
  });

  return readiness;
}
