import { invoke, type InvokeArgs } from "@tauri-apps/api/core";

const pending = new Map<string, number>;

export function newCancelId(instanceId: string): string {
  return instanceId + "-download-" + crypto.getRandomValues(new Uint32Array(4)).join("-");
}

export function hasActiveDownloads(cancelId: string): boolean {
  return pending.has(cancelId);
}

export async function invokeDownload<T>(
  command: "concurrently_download" | "repair_legacy_mrpack",
  arguments_: InvokeArgs & { "cancelId": string },
): Promise<T> {
  const { cancelId } = arguments_;

  pending.set(cancelId, (pending.get(cancelId) ?? 0) + 1);
  try {
    return await invoke<T>(command, arguments_);
  } finally {
    const remaining = pending.get(cancelId)! - 1;

    if (remaining) pending.set(cancelId, remaining);
    else pending.delete(cancelId);
  }
}
