import { create } from "@/lib/instances/create.ts";
import { findCurrent } from "@/lib/instances/find-current.ts";
import { getMinecraftDirectory } from "@/lib/instances/get-minecraft-directory.ts";
import { readInstances } from "@/lib/instances/read-instances.ts";
import { InstanceDefaults, resetPageStates } from "@/lib/instances/reset-page-states.ts";
import { sync } from "@/lib/instances/sync.ts";

export default Object.assign(InstanceDefaults, {
  create,
  findCurrent,
  getMinecraftDirectory,
  readInstances,
  resetPageStates,
  sync,
} as const);
