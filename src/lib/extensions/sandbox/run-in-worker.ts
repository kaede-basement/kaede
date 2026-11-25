import { log } from "@/lib/logging/log.ts";
import { fetchForExtension } from "@/lib/permissions/atomic/internet.ts";
import { handleLoggingPermission } from "@/lib/permissions/atomic/logging.ts";
import { recordStaticGrants } from "@/lib/permissions/grant-static-permissions.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";
import { permissionSession } from "@/lib/permissions/request-permissions.ts";
import { throwIfAborted } from "@/lib/shared/abort.ts";
import { ExtensionUI } from "@/lib/shared/ui-root.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

import type { Lifecycle } from "./lifecycle-hooks.ts";
import { createSandboxWorker, supportsWorkerSandbox } from "./worker/availability.ts";
import { WorkerSession } from "./worker/session.ts";
import { WorkerUIHost } from "./worker/ui-host.ts";

export async function runInWorker(
  extension: ExtensionType, lifetime: AbortController,
): Promise<Record<Lifecycle, () => Promise<void>>> {
  if (!supportsWorkerSandbox()) throw new Error("This WebView cannot run Worker sandboxes");
  const { id, code, metadata, artifactSha256 } = extension;
  const permissions = metadata.permissions ?? [];
  const service = permissionSession.value;

  if (!service) {
    throw new Error("Permission session closed");
  }
  const grants = new Set<string>(permissions);

  recordStaticGrants(artifactSha256, permissions);
  const requireGrant = (raw: string): void => {
    if (!grants.has(raw)) {
      throw new Error("Missing permission");
    }
  };
  const worker = createSandboxWorker();
  const roots = new ExtensionUI(id, lifetime.signal);
  const ui = new WorkerUIHost(roots, grants, event => worker.postMessage(event));
  let nextBody = 0;
  const bodies = new Map<number, Awaited<ReturnType<typeof fetchForExtension>>>;
  const session = new WorkerSession(worker, async (request, signal) => {
    switch (request.kind) {
      case "permissions": {
        const approved = await service.request(request.input, id, artifactSha256, signal);

        for (const raw of approved) {
          if (raw) {
            grants.add(raw);
          }
        }

        return approved;
      }
      case "read-log": {
        requireGrant("log::read");
        const read = handleLoggingPermission({
          id, "scope": "read", signal,
        }) as () => Promise<string>;

        return read();
      }
      case "fetch": {
        requireGrant(request.permission);
        const scope = parsePermission(request.permission);

        if (scope?.base !== "internet") {
          throw new Error("Expected an internet permission");
        }
        const response = await fetchForExtension(
          { id, "scope": scope.scope, "argument": scope.url },
          request.transport,
          request.url,
          request.body,
          request.contentType,
          signal);

        if (signal.aborted) {
          response.release?.();
          throwIfAborted(signal);
        }
        const handle = response.release ? ++nextBody : null;

        if (handle !== null) bodies.set(handle, response);

        return { ...response.metadata, handle };
      }
      case "read-body": {
        const response = bodies.get(request.handle);

        if (!response) throw new TypeError("Response body already consumed");
        bodies.delete(request.handle);

        return response.arrayBuffer();
      }
      case "release-body": {
        bodies.get(request.id)?.release?.();
        bodies.delete(request.id);

        return null;
      }
    }
  }, message => {
    if (message.kind === "event-error") {
      log.error(id, "UI event handler failed", message.error);

      return;
    }
    const { level, messages } = message;

    requireGrant("log::write");
    log[level](id, ...messages);
  }, (ops, seq) => ui.commit(ops, seq));

  lifetime.signal.addEventListener("abort", () => session.dispose(), { "once": true });
  session.lifetime.signal.addEventListener("abort", () => {
    for (const body of bodies.values()) body.release?.();
    bodies.clear();
    ui.dispose();
    lifetime.abort(session.lifetime.signal.reason);
  }, { "once": true });
  await session.start(id, code, permissions);

  return {
    "enable"      : (): Promise<void> => session.lifecycle("enable"),
    "disable"     : (): Promise<void> => session.lifecycle("disable"),
    "afterDisable": (): Promise<void> => session.lifecycle("afterDisable"),
  };
}
