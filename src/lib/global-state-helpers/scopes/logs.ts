import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

function toggle<Key extends keyof GlobalStatesType["logs"]>(
  key: Key,
  state?: boolean,
): void {
  const logs = GlobalStateHelpers.get().logs;

  if (typeof logs[key] !== "boolean") {
    return;
  }

  const newLogs = {
    ...logs,
    [key]: state ?? !logs[key],
  };

  GlobalStateHelpers.change("logs", newLogs);
}

export const Logs = {
  toggle,
};