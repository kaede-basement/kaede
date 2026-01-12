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
function filterBy(newValue: string): void {
  const logs = GlobalStateHelpers.get().logs;

  GlobalStateHelpers.change("logs", {
    ...logs,
    "filtering": newValue,
  });
}
function selectMode(newValue: string): void {
  const logs = GlobalStateHelpers.get().logs;

  GlobalStateHelpers.change("logs", {
    ...logs,
    "mode": newValue,
  });
}

export const Logs = {
  toggle,
  filterBy,
  selectMode,
};
