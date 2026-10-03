<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

import PermissionsHandler from "@/components/general/extensions/PermissionsHandler.vue";
import PageTeleports from "@/components/general/layout/PageTeleports.vue";
import { GlobalObject } from "@/extendable/global-object.ts";
import Errors from "@/lib/errors";
import ExtensionAPI from "@/lib/extension-api";
import Extensions from "@/lib/extensions";
import { findListIndex } from "@/lib/extensions/find-list-index.ts";
import { log } from "@/lib/logging/log.ts";
import Permissions from "@/lib/permissions";
import Txiki from "@/lib/txiki";
import { extensionStates, trustedExtensionHashes } from "@/states/extension.ts";
import { globalStates } from "@/states/global.ts";
import type { ExtensionType } from "@/types/extensions/extension.type.ts";

GlobalObject.libs.ExtensionAPI = ExtensionAPI;
GlobalObject.libs.Extensions = Extensions;
GlobalObject.libs.Permissions = Permissions;
GlobalObject.libs.Txiki = Txiki;

onMounted(async () => {
  // A background task to update the trusted hashes
  void Extensions.updateTrustedHashes();

  log.debug(__PRE_BUNDLED_FILENAME__, "Getting all extensions");
  const { valid, invalid } = await Extensions.readExtensions();

  extensionStates.valid = valid;
  extensionStates.invalid = invalid;

  const list = globalStates.extensions.list;

  // Add missing valid extensions
  for (const extension of valid) {
    if (findListIndex(list, extension) === -1) {
      const label: string = `${extension.metadata.name} (${extension.id})`;

      list.push({ "sha256": extension.artifactSha256, "enabled": false, label });
    }
  }

  const isEnabled = (extension: ExtensionType): boolean => (
    list[findListIndex(list, extension)].enabled
  );
  const toExecute: Record<
    ExtensionType["metadata"]["type"],
    Array<ExtensionType>
  > = {
    "sandbox": valid.filter(extension => (
      isEnabled(extension) &&
      extension.metadata.type === "sandbox"
    )),
    "unrestricted": valid.filter(extension => (
      isEnabled(extension) &&
      extension.metadata.type === "unrestricted" && (
        trustedExtensionHashes.value.has(extension.codeSha256) ||
        globalStates.extensions.allowUnrestrictedUntrusted
      )
    )),
  };

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled unrestricted extensions");
  for (const extension of toExecute.unrestricted) {
    const { id, code, metadata, artifactSha256 } = extension;
    const needsCleanRun: boolean = await Extensions.dirtyLifecycle(
      extensionStates.executed,
      extension,
      true,
    );

    if (!needsCleanRun) {
      continue;
    }

    const api = await Extensions.runInUnrestricted(id, code, metadata, artifactSha256);

    // If 'api' is missing, then the extension did not load
    if (!api) {
      const index = findListIndex(globalStates.extensions.list, extension);

      // We need to show that the extension was not enabled
      globalStates.extensions.list[index].enabled = false;

      continue;
    }

    /*
     * 'needsCleanRun' simply represents if the extension is in 'extensionStates.executed',
     * so here we know that it is not in 'extensionStates.executed', yet
     */
    extensionStates.executed = [
      ...extensionStates.executed,
      { extension, api },
    ];
  }

  const hasSandboxedPlugins = toExecute.sandbox.length > 0;

  if (!hasSandboxedPlugins) {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      "User does not have sandboxed plugins. No sandbox workers are needed",
    );

    return await Extensions.showWebviewWindow();
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing all enabled sandboxed extensions");
  for (const extension of toExecute.sandbox) {
    const { id, artifactSha256, code, metadata } = extension;
    const needsCleanRun: boolean = await Extensions.dirtyLifecycle(
      extensionStates.executed,
      extension,
      true,
    );

    if (!needsCleanRun) {
      continue;
    }

    const permissions = metadata.permissions ?? [];

    const api = await Extensions.runInSandbox({ id, artifactSha256, permissions, code });

    // If 'api' is missing, then the extension did not load
    if (!api) {
      const index = findListIndex(globalStates.extensions.list, extension);

      // We need to show that the extension was not enabled
      globalStates.extensions.list[index].enabled = false;

      continue;
    }

    /*
     * 'needsCleanRun' simply represents if the extension is in 'extensionStates.executed',
     * so here we know that it is not in 'extensionStates.executed', yet
     */
    extensionStates.executed = [
      ...extensionStates.executed,
      { extension, api },
    ];
  }

  await Extensions.showWebviewWindow();
});

onUnmounted(async () => {
  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Disabling ${extensionStates.executed.length} enabled extensions`,
  );
  for (const { extension, api } of extensionStates.executed) {
    try {
      log.debug(
        __PRE_BUNDLED_FILENAME__,
        `Disabling extension '${extension.id}' (artifact sha256: ${extension.artifactSha256})`,
      );
      const currentStatus: boolean = globalStates.extensions.list[
        findListIndex(globalStates.extensions.list, extension)
      ]?.enabled ?? false;

      if (currentStatus) {
        await api.disable();
      } else {
        log.warn(
          __PRE_BUNDLED_FILENAME__,
          `Extension '${extension.id}' seems to be already disabled`,
        );
      }
    } catch (error: unknown) {
      log.error(
        __PRE_BUNDLED_FILENAME__,
        `Error while disabling extension '${extension.id}' ` +
        `(artifact sha256: ${extension.artifactSha256}):`,
        Errors.prettify(error),
      );
    }
  }
  log.info(
    __PRE_BUNDLED_FILENAME__,
    `Disabled ${extensionStates.executed.length} enabled extensions`,
  );
});
</script>

<template>
  <div id="__extension-loader__wrapper"></div>
  <PermissionsHandler />

  <!-- 'PageTeleports' are not used by the launcher itself -->
  <!-- so their only usage will be provided by extensions -->
  <PageTeleports />
</template>
