import { computed, reactive, shallowReactive } from "vue";

import { LaunchStatus } from "@/constants/launcher.ts";
import { createDownloadMap } from "@/lib/network/download-map.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";
import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

type Install = {
  "kind"      : "installing";
  "instanceId": string;
  "cancel"?   : () => Promise<void>;
  "statuses"  : LauncherStatusesType;
};
type Run = {
  "kind"     : "running" | "stopping";
  "process"  : MinecraftProcessType;
  "statuses" : LauncherStatusesType;
  "startedAt": number;
};
type Operation = Install | Run | { "kind": "launching"; "statuses": LauncherStatusesType };
const operations = shallowReactive(new Map<string, Operation>);

export const Launches = reactive<Record<string, LauncherStatusesType>>({});
const idle = { "kind": "idle" } as const;

export function operation(id: string): Operation | typeof idle {
  return operations.get(id) ?? idle;
}

export function activeRun(id: string): Run | undefined {
  const op = operations.get(id);

  return op?.kind === "running" || op?.kind === "stopping" ? op : undefined;
}

export function operationIds(): IterableIterator<string> {
  return operations.keys();
}

function status(instanceId: string): LauncherStatusesType {
  return {
    instanceId, "launching": 1, "current"  : LaunchStatus.General.Starting,
    "downloads": { "current": createDownloadMap(), "success": 0, "failed": 0, "total": 0 },
  };
}

export function beginLaunch(id: string): LauncherStatusesType | undefined {
  if (operations.has(id)) return;
  const statuses = reactive(status(id));

  operations.set(id, { "kind": "launching", statuses });
  Launches[id] = statuses;

  return statuses;
}

export function finishLaunch(id: string, statuses: LauncherStatusesType): void {
  const op = operations.get(id);

  if (op?.kind === "launching" && op.statuses === statuses) {
    statuses.launching = 0;
    operations.delete(id);
  }
}

function findInstall(): Install | undefined {
  for (const op of operations.values()) {
    if (op.kind === "installing") return op;
  }
}

export const ActiveInstall = computed(findInstall);

export function beginInstall(id: string, progress = status(id)): Install {
  if (operations.has(id) || ActiveInstall.value) throw new Error("Another operation is active");
  const install = shallowReactive<Install>({
    "kind": "installing", "instanceId": id, "statuses": reactive(progress),
  });

  operations.set(id, install);
  Launches[id] = install.statuses;

  return install;
}

export function finishInstall(install: Install): void {
  if (operations.get(install.instanceId) === install) {
    delete Launches[install.instanceId];
    operations.delete(install.instanceId);
  }
}

export function recordRun(
  id: string, process: MinecraftProcessType, startedAt: number, rehydrated: boolean,
): boolean {
  const op = operations.get(id);

  if (op && (op.kind !== "launching" || rehydrated)) return false;
  const statuses = op?.statuses ?? reactive(status(id));

  operations.set(id, { "kind": "running", process, startedAt, statuses });
  statuses.launching = 2;
  statuses.current = LaunchStatus.General.Success;
  Launches[id] = statuses;

  return true;
}

export function beginStop(id: string): Run | undefined {
  const run = activeRun(id);

  if (run?.kind !== "running") return;
  const stopping = { ...run, "kind": "stopping" } as const;

  operations.set(id, stopping);

  return stopping;
}

export function undoStop(id: string, run: Run): void {
  if (operations.get(id) === run) operations.set(id, { ...run, "kind": "running" });
}

export function finishRun(id: string, token: string): void {
  const run = activeRun(id);

  if (run?.process.token === token) {
    run.statuses.current = LaunchStatus.General.Aborted;
    run.statuses.launching = 0;
    operations.delete(id);
  }
}
