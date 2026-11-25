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

import Errors from "@/lib/errors";
import { runInUnrestricted } from "@/lib/extensions/run-in-unrestricted.ts";
import { runInSandbox } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { log } from "@/lib/logging/log.ts";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

type Setting = { "enabled": boolean };
type ActivationResult = "policy-skipped" | void;
const active = (new Set<string>);
const pending = (new Map<string, Promise<ActivationResult>>);
let session: symbol | undefined;

export function startExtensionSession(): () => void {
  const owner = Symbol();

  session = owner;

  return () => {
    if (session !== owner) {
      return;
    }
    session = undefined;
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
      try {
        await existing.api.disable();
      } catch (error) {
        log.error(__PRE_BUNDLED_FILENAME__, `Failed to disable '${id}':`, Errors.prettify(error));

        return;
      }
      active.delete(artifactSha256);
      if (setting && owner === session) {
        await existing.api.afterDisable();
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
      api = (metadata.type === "sandbox"
        ? runInSandbox({ id, code, "permissions": metadata.permissions })
        : await runInUnrestricted(id, code, metadata, artifactSha256)) || undefined;
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
  const previous = pending.get(key);
  const run = async (): Promise<ActivationResult> => {
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
