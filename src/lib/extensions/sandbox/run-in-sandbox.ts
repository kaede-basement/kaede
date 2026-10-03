/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { createSafeDocument } from "ark-of-atrahasis";

import { SandboxLimits } from "@/constants/sandbox.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import Errors from "@/lib/errors";
import { findListIndex } from "@/lib/extensions/find-list-index.ts";
import { createHostMethods } from "@/lib/extensions/sandbox/host/host-methods.ts";
import {
  createSandboxHost,
  type SandboxHostType,
} from "@/lib/extensions/sandbox/host/sandbox-host.ts";
import { createUIHost, type UIEnvironmentType } from "@/lib/extensions/sandbox/host/ui-host.ts";
import type {
  SandboxBootMessage,
  SandboxLifecycleHook,
} from "@/lib/extensions/sandbox/protocol.ts";
import SandboxWorker from "@/lib/extensions/sandbox/worker/main.ts?worker&inline";
import { log } from "@/lib/logging/log.ts";
import { fetchForPlugin } from "@/lib/permissions/atomic/internet.ts";
import { readPluginLog, writePluginLog } from "@/lib/permissions/atomic/logging.ts";
import { getGrantKey } from "@/lib/permissions/get-grant-key.ts";
import { grantStaticPermissions } from "@/lib/permissions/grant-static-permissions.ts";
import { extensionStates } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

type SandboxedAPIType = Record<SandboxLifecycleHook, () => Promise<void>>;

// A terminated plugin is no longer executed and is shown as disabled
function forgetExtension(artifactSha256: string): void {
  extensionStates.executed = extensionStates.executed.filter(({ extension }) => !(
    extension.artifactSha256 === artifactSha256 && extension.metadata.type === "sandbox"
  ));

  const list = globalStates.extensions.list;
  const entry = list[findListIndex(list, { artifactSha256 })];

  if (entry !== undefined) {
    entry.enabled = false;
  }
}

function createContainerId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));

  const hex: string = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");

  return `__extension-sandbox__container-${hex}`;
}

const UIEnvironment: UIEnvironmentType = {
  "mount": elementId => {
    const parent: HTMLElement | null = document.getElementById(elementId);

    if (parent === null) {
      return;
    }

    const container: HTMLDivElement = document.createElement("div");

    container.id = createContainerId();
    // Keeps 'position: fixed' plugin content inside the container
    container.style.contain = "paint";
    parent.append(container);

    return { "containerId": container.id, "unmount": () => container.remove() };
  },
  createSafeDocument,
  "scheduleFrame": callback => requestAnimationFrame(() => callback()),
  "currentTarget": () => window.event?.currentTarget ?? null,
};

function startWorker({ id, artifactSha256, code, permissions }: {
  "id"            : string;
  "artifactSha256": string;
  "code"          : string;
  "permissions"   : Array<string>;
}): Promise<SandboxHostType | undefined> {
  const grantKey: string = getGrantKey(artifactSha256);
  const isGranted = (permission: string): boolean => (
    globalStates.extensions.permissions[grantKey]?.[permission] === true
  );
  const requestPermissions = (requested: unknown): Promise<Array<[string, boolean]>> => (
    GlobalInternals.requestPermissions(requested, id, artifactSha256)
  );
  const worker = new SandboxWorker({ "name": id });
  const channel = (new MessageChannel);
  let settle!: (started: boolean) => void;
  const started = new Promise<boolean>(resolve => {
    settle = resolve;
  });
  const ui = createUIHost({
    isGranted,
    "notify"       : (method, parameters) => host.notify(method, parameters),
    "maxNodes"     : SandboxLimits.UINodes,
    "maxOperations": SandboxLimits.UIOperations,
    "environment"  : UIEnvironment,
  });
  const host: SandboxHostType = createSandboxHost({
    id,
    "port"           : channel.port1,
    "messageBytes"   : SandboxLimits.MessageBytes,
    "terminateWorker": () => worker.terminate(),
    "onTerminated"   : () => {
      ui.dispose();
      settle(false);
      forgetExtension(artifactSha256);
    },
    "methods": {
      "ui.ops": { "kind": "notify", "handle": parameters => ui.apply(parameters) },
      ...createHostMethods({
        isGranted,
        requestPermissions,
        "writeLog": (level, input) => writePluginLog(id, level, input),
        "readLog" : () => readPluginLog(id),
        "fetch"   : request => fetchForPlugin(id, request),
      }),
      "ready": { "kind": "notify", "handle": () => settle(true) },
      "fatal": {
        "kind"  : "notify",
        "handle": parameters => {
          log.error(
            __PRE_BUNDLED_FILENAME__,
            `The '${id}' extension failed to start in the sandbox:`,
            String((parameters as { "message"?: unknown } | undefined)?.message),
          );
          host.terminate("the plugin failed to start");
        },
      },
    },
  });

  worker.addEventListener("error", (event: ErrorEvent) => {
    log.error(
      __PRE_BUNDLED_FILENAME__,
      `An uncaught error occurred in the '${id}' extension:`,
      String(event.message),
    );
  });
  worker.postMessage(
    { "source": code, permissions } satisfies SandboxBootMessage,
    [channel.port2],
  );

  const timer = setTimeout(() => (
    host.terminate(`the plugin code did not finish in ${SandboxLimits.LifecycleTimeoutMs} ms`)
  ), SandboxLimits.LifecycleTimeoutMs);

  return started.then(ready => {
    clearTimeout(timer);

    return ready ? host : undefined;
  });
}

/**
 * Runs a sandboxed plugin in its own dedicated worker.
 *
 * @param options - the plugin, its static permissions, and the artifact its grants belong to
 * @returns lifecycle handlers once the plugin code finished evaluating,
 * or nothing if the plugin failed to start
 */
export async function runInSandbox({
  id,
  artifactSha256,
  code,
  permissions = [],
}: {
  "id"            : string;
  // Grants are stored per artifact, so a changed archive with the same ID does not inherit them
  "artifactSha256": string;
  "code"          : string;
  "permissions"?  : Array<PermissionType>;
}): Promise<void | SandboxedAPIType> {
  let granted: Array<string>;

  try {
    granted = grantStaticPermissions({ artifactSha256, permissions });
  } catch (error: unknown) {
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `Could not grant static permissions to the '${id}' extension:`,
      Errors.prettify(error),
    );
  }

  const host: SandboxHostType | undefined = await startWorker({
    id,
    artifactSha256,
    code,
    "permissions": granted,
  });

  if (host === undefined) {
    return;
  }

  const call = async (hook: SandboxLifecycleHook): Promise<void> => {
    if (host.isTerminated()) {
      forgetExtension(artifactSha256);

      throw new Error(`The '${id}' extension was terminated`);
    }

    await host.request("lifecycle", { hook }, SandboxLimits.LifecycleTimeoutMs);
  };

  log.info(__PRE_BUNDLED_FILENAME__, `The '${id}' extension started in the sandbox`);

  return {
    "enable"      : () => call("enable"),
    "disable"     : () => call("disable"),
    "afterDisable": () => call("afterDisable"),
  };
}
