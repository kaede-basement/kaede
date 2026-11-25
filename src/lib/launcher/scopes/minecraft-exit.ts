import Hooks from "@/lib/hooks";
import { processLifetime } from "@/lib/processes/core.ts";
import { operation } from "@/states/instance-operation.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

const notified = new WeakSet<object>;
const selected = new WeakSet<object>;
const unmanagedSelections = new Set<string>;

export function claimMinecraftProcess(process: MinecraftProcessType): boolean {
  const lifetime = processLifetime(process);

  if (!lifetime) {
    const key = `${process.token}:${process.pid}`;

    if (unmanagedSelections.has(key)) return false;
    unmanagedSelections.add(key);

    return true;
  }
  if (selected.has(lifetime)) return false;
  selected.add(lifetime);

  return true;
}

export async function notifyMinecraftExit(
  instanceId: string, process: MinecraftProcessType,
): Promise<void> {
  const identity = processLifetime(process) ?? process;

  if (notified.has(identity)) return;
  notified.add(identity);
  const op = operation(instanceId);

  // A launch hook may still select this child after it has already exited.
  await (op.kind === "launching" && !op.exited ? op.selection.promise : undefined);
  await Hooks.catchAsyncVoidHooks({
    "scope": "onMinecraftKill", "toPass": process.pid, "timing": "after",
  });
}
