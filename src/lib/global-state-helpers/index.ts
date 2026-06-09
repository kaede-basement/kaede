import { GlobalInternals } from "@/extendable/global-internals.ts";
import { changeGlobalState } from "@/lib/global-state-helpers/scopes/change-global-state.ts";
import {
  getConfigGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-config-global-states.ts";
import {
  getDefaultGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-default-global-states.ts";
import { Layout } from "@/lib/global-state-helpers/scopes/layout.ts";
import { Logs } from "@/lib/global-state-helpers/scopes/logs.ts";
import { Pages } from "@/lib/global-state-helpers/scopes/pages.ts";
import { showContextMenu } from "@/lib/global-state-helpers/scopes/show-context-menu.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export default {
  "get"          : (): GlobalStatesType => GlobalInternals.getGlobalStates(),
  "change"       : changeGlobalState,
  "getFromConfig": getConfigGlobalStates,
  "getDefault"   : getDefaultGlobalStates,
  Layout,
  Logs,
  Pages,
  showContextMenu,
} as const;
