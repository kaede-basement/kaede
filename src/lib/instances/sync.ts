import FileStructure from "@/constants/file-structure.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { createStateSync } from "@/lib/configs/sync.ts";
import { flushPlaytime, instanceStates } from "@/states/instance.ts";

const write = createStateSync(
  FileStructure.Files.Metadata,
  () => GlobalInternals.initialInstances,
  () => instanceStates,
);

export const sync = (): Promise<void> => flushPlaytime(write);
