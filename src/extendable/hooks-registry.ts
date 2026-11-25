import type { KaedeNamespaceType } from "@/declarations.ts";

type HookHost = Pick<KaedeNamespaceType, "hooks">;
let host: HookHost | undefined;
const initialHooks: HookHost["hooks"] = {
  "onConfigFileGet"              : { "before": [], "after": [] },
  "onDefaultConfigGet"           : { "before": [] },
  "onPreLaunchInformation"       : { "before": [], "after": [] },
  "onVersionMeta"                : { "before": [], "after": [] },
  "onLibrariesParsing"           : { "before": [], "after": [] },
  "onMinecraftAssetsGet"         : { "before": [], "after": [] },
  "onMinecraftPatchesGet"        : { "before": [], "after": [] },
  "onMinecraftClientGet"         : { "before": [], "after": [] },
  "onMinecraftLoggingGet"        : { "before": [], "after": [] },
  "onMinecraftLibrariesGet"      : { "before": [], "after": [] },
  "onNativesExtract"             : { "before": [], "after": [] },
  "onJavaBinaryGet"              : { "before": [] },
  "onJVMArgumentsGet"            : { "before": [], "after": [] },
  "onClassPathsGet"              : { "before": [] },
  "onGameArgumentsGet"           : { "before": [], "after": [] },
  "onAdditionalStartArgumentsGet": { "before": [] },
  "onLaunchArgumentsReplace"     : { "before": [], "after": [] },
  "onMinecraftLaunch"            : { "before": [], "after": [] },
  "onMinecraftKill"              : { "before": [], "after": [] },
  "onMinecraftPatchResolve"      : { "before": [], "after": [] },
};

export function bindHookHost(namespace: HookHost): void {
  host = namespace;
}

export function getHooks(): HookHost["hooks"] {
  return host ? host.hooks : initialHooks;
}
