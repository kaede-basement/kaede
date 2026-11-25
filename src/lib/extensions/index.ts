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

import { setExtensionEnabled, startExtensionSession } from "@/lib/extensions/dirty-lifecycle.ts";
import { readExtensions } from "@/lib/extensions/read-extensions.ts";
import { runInUnrestricted } from "@/lib/extensions/run-in-unrestricted.ts";
import { onGlobalStateChange } from "@/lib/extensions/sandbox/events/on-global-state-change.ts";
import { onInstanceStateChange } from "@/lib/extensions/sandbox/events/on-instance-state-change.ts";
import { grantEventListeners } from "@/lib/extensions/sandbox/grant-event-listeners.ts";
import { runInSandbox, SandboxEnvironment } from "@/lib/extensions/sandbox/run-in-sandbox.ts";
import { showWebviewWindow } from "@/lib/extensions/show-webview-window.ts";
import { updateTrustedHashes } from "@/lib/extensions/update-trusted-hashes.ts";
import { bindPermissionRequest } from "@/lib/permissions";

export default Object.assign(SandboxEnvironment, {
  async requestPermissions(
    input: unknown, id: string, artifactSha256: string,
  ): Promise<Array<unknown>> {
    return bindPermissionRequest(id, artifactSha256)(input);
  },
  setExtensionEnabled,
  startExtensionSession,
  readExtensions,
  runInUnrestricted,
  onGlobalStateChange,
  onInstanceStateChange,
  grantEventListeners,
  runInSandbox,
  showWebviewWindow,
  updateTrustedHashes,
} as const);
