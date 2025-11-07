import { ApplicationNamespace } from "@/constants/application.ts";
import {
  getConfigGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-config-global-states.ts";
import {
  getDefaultGlobalStates,
} from "@/lib/global-state-helpers/scopes/get-default-global-states.ts";
import { Layout } from "@/lib/global-state-helpers/scopes/layout.ts";
import { Logs } from "@/lib/global-state-helpers/scopes/logs.ts";
import { Pages } from "@/lib/global-state-helpers/scopes/pages.ts";

export default {
  "get"          : window[ApplicationNamespace].__internals.getGlobalStates,
  "change"       : window[ApplicationNamespace].__internals.changeGlobalStates,
  "getFromConfig": getConfigGlobalStates,
  "getDefault"   : getDefaultGlobalStates,
  Layout,
  Logs,
  Pages,
} as const;