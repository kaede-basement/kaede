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

import { shallowRef } from "vue";

import { activationAbortReason, throwIfAborted } from "@/lib/extensions/sandbox/abort.ts";
import { parsePermission } from "@/lib/permissions/parse-permission.ts";

export const PermissionCooldownMs = 5000;

type GrantStore = Record<string, Record<string, boolean>>;
type Prompt = { "id": number; "extension": string; "permission": string; "deadline": number };

export function artifactGrantKey(hash: unknown): string {
  if (typeof hash !== "string" || !(/^[a-f0-9]{64}$/u).test(hash)) {
    throw new TypeError("Expected an artifact SHA-256 digest");
  }

  return `artifact/${hash}`;
}

export class PermissionService {
  readonly prompt = shallowRef<Prompt>();
  private queue   : Promise<void> = Promise.resolve();
  private nextId = 0;
  private disposed = false;
  private resolve?: (allowed: boolean) => void;
  private reject? : (error: Error) => void;

  constructor(private store: GrantStore, private now: () => number = () => performance.now()) {}

  async request(
    input: unknown, extension: string, artifactSha256: string, signal?: AbortSignal,
  ): Promise<Array<string | false>> {
    const key = artifactGrantKey(artifactSha256);

    if (!Array.isArray(input)) {
      throw new TypeError("Expected an array of permissions");
    }
    const batch: Array<string> = [];
    const length = input.length;

    if (!Number.isSafeInteger(length) || length < 0 || length > 0xFF_FF_FF_FF) {
      throw new TypeError("Invalid permission array length");
    }
    for (let index = 0; index < length; index++) {
      const parsed = parsePermission(input[index]);

      if (!parsed) {
        throw new TypeError("Invalid permission");
      }
      batch.push(parsed.raw);
    }
    throwIfAborted(signal);
    let abortPrompt: (() => void) | undefined;
    let rejectRequest: (reason: unknown) => void;
    const cancelled = new Promise<never>((_, reject) => {
      rejectRequest = reject;
    });
    const abort = (): void => {
      abortPrompt?.();
      rejectRequest(activationAbortReason(signal));
    };

    signal?.addEventListener("abort", abort, { "once": true });
    const result = this.queue.then(async () => {
      throwIfAborted(signal);
      if (this.disposed) {
        throw new Error("Permission session closed");
      }
      const granted: Array<string | false> = [];

      for (const permission of batch) {
        let allowed = this.store[key]?.[permission];

        if (typeof allowed !== "boolean") {
          allowed = await new Promise<boolean>((resolve, reject) => {
            abortPrompt = (): void => {
              reject(activationAbortReason(signal));
              this.clear();
            };
            this.resolve = resolve;
            this.reject = reject;
            this.prompt.value = {
              "id"      : ++this.nextId,
              extension,
              permission,
              "deadline": this.now() + PermissionCooldownMs,
            };
          });
          abortPrompt = undefined;
          throwIfAborted(signal);
          if (this.disposed) {
            throw new Error("Permission session closed");
          }
          this.store[key] ??= {};
          this.store[key][permission] = allowed;
        }
        granted.push(allowed ? permission : false);
      }

      return granted;
    });

    this.queue = result.then(() => {}, () => {});

    try {
      return await (signal ? Promise.race([result, cancelled]) : result);
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }

  answer(id: number, allowed: boolean): boolean {
    const prompt = this.prompt.value;

    if (!prompt || prompt.id !== id || (allowed && this.now() < prompt.deadline)) {
      return false;
    }
    this.resolve?.(allowed);
    this.clear();

    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.reject?.(new Error("Permission session closed"));
    this.clear();
  }

  private clear(): void {
    this.prompt.value = undefined;
    this.resolve = undefined;
    this.reject = undefined;
  }
}

export const permissionSession = shallowRef<PermissionService>();
