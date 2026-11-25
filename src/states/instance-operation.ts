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
  "process"        : MinecraftProcessType;
  "statuses"       : LauncherStatusesType;
  "startedAt"      : number;
  "launchPending"  : boolean;
  "excludeSibling"?: (token: string) => void;
  "exit"?          : ReturnType<typeof completion>;
} & ({ "kind": "running" } | { "kind": "stopping"; "closed": Promise<void> });
type Launch = { "kind": "launching"; "statuses": LauncherStatusesType } & (
  { "exited": false; "selection": ReturnType<typeof completion> } | { "exited": true }
);
type Operation = Install | Run | Launch;
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

  operations.set(id, { "kind": "launching", statuses, "exited": false, "selection": completion() });
  Launches[id] = statuses;

  return statuses;
}

export function finishLaunch(id: string, statuses: LauncherStatusesType): void {
  const op = operations.get(id);

  if (!op || op.kind === "installing" || op.statuses !== statuses) return;
  if (op.kind === "launching") {
    if (op.exited) statuses.current = LaunchStatus.General.Aborted;
    else op.selection.resolve();
    statuses.launching = 0;
    operations.delete(id);
  } else {
    op.launchPending = false;
    statuses.launching = 2;
    statuses.current = LaunchStatus.General.Success;
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

  install.statuses.current = undefined;
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

function completion(): { "promise": Promise<void>; "resolve": () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });

  return { promise, resolve };
}

export function recordRun(
  id: string, process: MinecraftProcessType, startedAt: number, rehydrated: boolean,
  managed = rehydrated, excludeSibling?: (token: string) => void,
): boolean {
  const op = operations.get(id);

  if (op && (op.kind !== "launching" || op.exited || rehydrated)) return false;
  op?.selection.resolve();
  const statuses = op?.statuses ?? reactive(status(id));

  operations.set(id, {
    "kind"         : "running", process, startedAt, statuses, excludeSibling, "launchPending": !!op,
    "exit"         : managed ? completion() : undefined,
  });
  if (!op) {
    statuses.launching = 2;
    statuses.current = LaunchStatus.General.Success;
  }
  Launches[id] = statuses;

  return true;
}

export function stopRun(id: string, stop: (run: Run) => Promise<void>): Promise<void> {
  const run = activeRun(id);

  if (!run) return Promise.resolve();
  if (run.kind === "stopping") return run.closed;
  const closed = Promise.resolve().then(() => stop(stopping))
    .finally(() => {
      if (operations.get(id) === stopping) {
        operations.set(id, { ...run, "launchPending": stopping.launchPending });
      }
    });
  const stopping: Run = { ...run, "kind": "stopping", closed };

  operations.set(id, stopping);

  return closed;
}

export function finishRun(id: string, token: string): void {
  const run = activeRun(id);

  if (run?.process.token === token) {
    run.exit?.resolve();
    run.statuses.current = LaunchStatus.General.Aborted;
    if (run.launchPending) {
      operations.set(id, { "kind": "launching", "statuses": run.statuses, "exited": true });
    } else {
      run.statuses.launching = 0;
      operations.delete(id);
    }
  }
}
