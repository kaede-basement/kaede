import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { createStateSync } from "@/lib/configs/sync.ts";
import { instanceStates } from "@/states/instance.ts";

export const sync = createStateSync(
  FileStructure.Files.Metadata,
  () => GlobalInternals.initialInstances,
  () => instanceStates,
);
