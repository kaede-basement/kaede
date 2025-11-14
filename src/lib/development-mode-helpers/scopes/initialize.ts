import {
  getDefaultDevelopmentStates,
} from "@/lib/development-mode-helpers/scopes/get-default-development-states.ts";
import GlobalStateHelpers from "@/lib/global-state-helpers";

export function initialize(): void {
  GlobalStateHelpers.change("development", getDefaultDevelopmentStates());
}
