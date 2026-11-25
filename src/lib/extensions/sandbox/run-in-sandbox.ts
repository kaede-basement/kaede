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

import "ses";

import Errors from "@/lib/errors";
import { lockdownEnvironment } from "@/lib/extensions/sandbox/lockdown-environment.ts";
import { log } from "@/lib/logging/log.ts";
import Permissions, { bindPermissionRequest } from "@/lib/permissions";
import { ExtensionUI } from "@/lib/shared/ui-root.ts";
import type { PermissionType } from "@/types/extensions/permission.type.ts";

import { lifecycleHooks, type SandboxHooks } from "./lifecycle-hooks.ts";

export const SandboxEnvironment = { lockdownEnvironment } as const;

export function runInSandbox({
  id,
  artifactSha256,
  code,
  lifetime = new AbortController,
  permissions = [],
}: {
  "id"            : string;
  "artifactSha256": string;
  "code"          : string;
  "lifetime"?     : AbortController;
  "permissions"?  : Array<PermissionType>;
}): void | SandboxHooks {
  try {
    // It will not lock down more than once
    SandboxEnvironment.lockdownEnvironment();
  } catch (error: unknown) {
    // Do not continue executing the plugin if the lockdown failed
    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `An error occurred while locking down the environment (extension '${id}'):`,
      Errors.prettify(error),
    );
  }

  const ui = new ExtensionUI(id, lifetime.signal);
  const requestPermissions = bindPermissionRequest(id, artifactSha256, ui, lifetime.signal);
  const scopedThis = Permissions.grantStaticPermissions({
    id, artifactSha256, permissions, ui, "signal": lifetime.signal,
  });

  try {
    const compartment = new Compartment({
      "globals": harden({
        requestPermissions,

        /*
         * Provide a reference to the plugin-scoped 'GrantedScopes' object to make it
         * modifiable from other JavaScript scopes, i.e. from 'ExtensionsManager#handlePermission'
         */
        "scopedThis": scopedThis,

        /*
         * Provide a reference to the plugin-scoped 'EventListeners' object to make it
         * modifiable from other JavaScript scopes, i.e. from 'ExtensionsManager#handleEvent'
         */
        // TODO: DO NOT DO THIS; CHANGE LATER --- "EventListeners": EventListeners[id],
      }),

      /*
       * Code execution does not work without this property,
       * and the documentation does not explain what '__options__' exactly do
       */
      "__options__": true,
    });

    return lifecycleHooks(compartment.evaluate(code));
  } catch (error: unknown) {
    lifetime.abort();

    return log.error(
      __PRE_BUNDLED_FILENAME__,
      `An error occurred while running the '${id}' extension in the compartment:`,
      Errors.prettify(error),
    );
  }
}
