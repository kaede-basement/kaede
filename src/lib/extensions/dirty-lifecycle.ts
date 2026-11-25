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

import { watch } from "vue";

import Errors from "@/lib/errors";
import { runInUnrestricted } from "@/lib/extensions/run-in-unrestricted.ts";
import { SandboxActivation } from "@/lib/extensions/sandbox/activation.ts";
import { runInSandbox } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { runInWorker } from "@/lib/extensions/sandbox/run-in-worker.ts";
import { canStartWorkerSandbox } from "@/lib/extensions/sandbox/worker/availability.ts";
import { log } from "@/lib/logging/log.ts";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type Setting = { "enabled": boolean };
type ActivationResult = "policy-skipped" | void;
const active = (new Set<string>);
const pending = (new Map<string, Promise<ActivationResult>>);
const sandboxes = new Map<string, SandboxActivation>;
const initialized = new Set<string>;
let session: symbol | undefined;

const sandboxEngine = (): "ses" | "worker" => globalStates.extensions.sandboxEngine ?? "ses";

export function startExtensionSession(): () => void {
  const owner = Symbol();

  initialized.clear();
  const stopWatching = watch(sandboxEngine, async (engine, previous) => {
    if (session !== owner) return;
    if (engine === "worker" && !await canStartWorkerSandbox()) {
      if (session === owner && globalStates.extensions.sandboxEngine === engine) {
        globalStates.extensions.sandboxEngine = previous;
        log.error(__PRE_BUNDLED_FILENAME__, "Worker sandbox unavailable in this WebView");
      }

      return;
    }
    if (session !== owner || engine !== sandboxEngine()) return;
    const settings = new Map(globalStates.extensions.list.map(entry => [entry.sha256, entry]));

    for (const extension of extensionStates.valid) {
      const entry = settings.get(extension.artifactSha256);

      if (extension.metadata.type === "sandbox" && entry?.enabled &&
        sandboxes.get(extension.artifactSha256)?.engine !== engine) {
        void setExtensionEnabled(extension, false);
        void setExtensionEnabled(extension, "restore", entry);
      }
    }
  });

  session = owner;

  return () => {
    stopWatching();
    if (session !== owner) {
      return;
    }
    session = undefined;
    for (const sandbox of sandboxes.values()) {
      sandbox.cancelPending();
    }
    for (const { extension } of extensionStates.executed) {
      void setExtensionEnabled(extension, false);
    }
  };
}

async function applyEnabled(
  extension: ExtensionType, enabled: boolean, owner: symbol | undefined, setting?: Setting,
): Promise<ActivationResult> {
  const { id, artifactSha256, codeSha256, metadata, code } = extension;

  if (enabled && (!owner || owner !== session || !globalStates.extensions.enabled)) {
    return;
  }
  if (enabled && metadata.type === "unrestricted" && !trustedExtensionHashes.value.has(codeSha256)
    && !globalStates.extensions.allowUnrestrictedUntrusted) {
    return "policy-skipped";
  }

  const existing = extensionStates.executed.find(entry => (
    entry.extension.artifactSha256 === artifactSha256
  ));

  if (!enabled) {
    const wasActive = active.has(artifactSha256);

    if (setting) {
      setting.enabled = false;
    }
    if (existing && wasActive) {
      const sandbox = sandboxes.get(artifactSha256);

      if (sandbox) {
        await sandbox.stop(existing.api, !!owner && owner === session);
      } else {
        await existing.api.disable();
        active.delete(artifactSha256);
        if (setting && owner === session) await existing.api.afterDisable();
      }
    }

    return;
  }

  if (!active.has(artifactSha256)) {
    let api = existing?.api;

    if (api) {
      try {
        await api.enable();
      } catch (error) {
        try {
          await api.disable();
        } catch (cleanupError) {
          log.error(
            __PRE_BUNDLED_FILENAME__, `Rollback failed for '${id}':`, Errors.prettify(cleanupError),
          );
        }
        throw error;
      }
    } else {
      if (metadata.type === "sandbox") {
        const sandbox = new SandboxActivation(sandboxEngine());
        const { lifetime } = sandbox;

        sandboxes.set(artifactSha256, sandbox);
        lifetime.signal.addEventListener("abort", () => {
          if (sandbox.phase === "active" && setting && owner === session) setting.enabled = false;
          sandboxes.delete(artifactSha256);
          active.delete(artifactSha256);
          extensionStates.executed = extensionStates.executed.filter(entry => (
            entry.extension.artifactSha256 !== artifactSha256
          ));
        }, { "once": true });
        try {
          if (sandbox.engine === "worker" && !await canStartWorkerSandbox()) {
            if (lifetime.signal.aborted) return;
            sandbox.engine = "ses";
            globalStates.extensions.sandboxEngine = "ses";
            log.warn(__PRE_BUNDLED_FILENAME__, "Worker sandbox unavailable, using SES");
          }
          if (lifetime.signal.aborted) return;
          api = (sandbox.engine === "worker"
            ? await runInWorker(extension, lifetime) : runInSandbox({
              id, artifactSha256, code, "permissions": metadata.permissions, lifetime,
            })) || undefined;
          if (api) {
            if (initialized.has(artifactSha256)) await sandbox.wait(api.enable);
            initialized.add(artifactSha256);
            sandbox.phase = "active";
          } else {
            if (setting) setting.enabled = false;
            lifetime.abort();
          }
        } catch (error) {
          if (sandbox.phase === "cancelled") return;
          lifetime.abort(error);
          throw error;
        }
        if (lifetime.signal.aborted) {
          return;
        }
      } else {
        api = await runInUnrestricted(id, code, metadata, artifactSha256) || undefined;
      }
    }
    if (owner !== session) {
      await api?.disable();

      return;
    }
    if (!api) {
      if (setting) {
        setting.enabled = false;
      }

      return;
    }
    if (!existing) {
      extensionStates.executed = [...extensionStates.executed, { extension, api }];
    }
    active.add(artifactSha256);
  }
  if (setting) {
    setting.enabled = true;
  }
}

export async function setExtensionEnabled(
  extension: ExtensionType, enabled: boolean | "restore", setting?: Setting,
): Promise<ActivationResult> {
  const owner = session;
  const key = extension.artifactSha256;

  if (typeof enabled === "boolean" && setting && extension.metadata.type === "sandbox") {
    setting.enabled = enabled;
  }
  const current = sandboxes.get(key);

  if (!enabled || current?.phase === "stopping") {
    current?.cancelPending();
  }
  const previous = pending.get(key);
  const run = async (): Promise<ActivationResult> => {
    if (enabled && extension.metadata.type === "sandbox" && pending.get(key) !== operation) return;
    if (enabled === "restore" && !setting?.enabled) {
      return;
    }
    try {
      return await applyEnabled(extension, enabled !== false, owner, setting);
    } catch (error) {
      if (enabled && setting && owner === session) {
        setting.enabled = false;
      }
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Extension lifecycle failed for '${extension.id}':`,
        Errors.prettify(error),
      );
    }
  };
  const operation = (previous ?? Promise.resolve()).then(run);

  pending.set(key, operation);
  try {
    return await operation;
  } finally {
    if (pending.get(key) === operation) {
      pending.delete(key);
    }
  }
}
