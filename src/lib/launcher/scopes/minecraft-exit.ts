import Hooks from "@/lib/hooks";
import { processLifetime } from "@/lib/processes/core.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

const notified = new WeakSet<object>;
const selected = new WeakSet<object>;
const unmanagedSelections = new Set<string>;

export function claimMinecraftProcess(process: MinecraftProcessType): boolean {
  const lifetime = processLifetime(process);

  if (!lifetime) {
    if (unmanagedSelections.has(process.token)) return false;
    unmanagedSelections.add(process.token);

    return true;
  }
  if (selected.has(lifetime)) return false;
  selected.add(lifetime);

  return true;
}

export function notifyMinecraftExit(process: MinecraftProcessType): void {
  const identity = processLifetime(process) ?? process;

  if (notified.has(identity)) return;
  notified.add(identity);
  // Run after all synchronous exit listeners have settled the instance and its playtime.
  queueMicrotask(() => {
    void Hooks.catchAsyncVoidHooks({
      "scope": "onMinecraftKill", "toPass": process.pid, "timing": "after",
    });
  });
}
