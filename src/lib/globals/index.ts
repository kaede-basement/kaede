import type { Component } from "vue";

import { declareGlobals } from "@/bootstrap/declare-globals.ts";
import { ActionRegistry, Actions } from "@/extendable/action-registry.ts";
import { __registerComponent, __restoreComponent, C } from "@/extendable/component-registry.ts";
import { GlobalInternals } from "@/extendable/global-internals.ts";
import { declareActionRegistry } from "@/lib/globals/declare-action-registry.ts";

const Globals = {
  declareActionRegistry,
  "declareGlobals"   : (): void => declareGlobals(Globals),
  Actions,
  ActionRegistry,
  "Components"       : C,
  "registerAction"   : ActionRegistry.register,
  "getAction"        : ActionRegistry.get,
  "executeAction"    : ActionRegistry.execute,
  "getAllActions"    : ActionRegistry.getAll,
  "registerComponent": __registerComponent,
  "restoreComponent" : __restoreComponent,
  "getComponent"     : (id: string): Component | undefined => (
    GlobalInternals.appInstance?.component?.(id)
  ),
} as const;

export default Globals;
