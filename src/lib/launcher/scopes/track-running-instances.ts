import Errors from "@/lib/errors";
import { log } from "@/lib/logging/log.ts";
import { rehydrateProcesses } from "@/lib/processes/core.ts";
import Watchers from "@/lib/watchers";
import type { ProcessHandlersType } from "@/types/application/server-process.type.ts";
import type { MinecraftProcessType } from "@/types/launcher/launch/launch-response.type.ts";

export function trackRunningInstances(
  attach: (handle: MinecraftProcessType) => ProcessHandlersType,
): () => Promise<boolean> {
  let hydration: Promise<boolean> | undefined;

  async function hydrate(): Promise<boolean> {
    try {
      await Watchers.watchProcesses();
      await rehydrateProcesses(handle => (
        handle.kind === "minecraft" ? attach(handle as MinecraftProcessType) : undefined
      ));

      return true;
    } catch (error) {
      log.error(
        __PRE_BUNDLED_FILENAME__, "Failed to restore running instances:", Errors.prettify(error),
      );
      hydration = undefined;

      return false;
    }
  }

  return () => hydration ??= hydrate();
}
