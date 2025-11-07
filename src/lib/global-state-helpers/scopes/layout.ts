import { ApplicationNamespace } from "@/constants/application.ts";
import { getGlobalStates } from "@/lib/global-state-helpers/scopes/get-global-states.ts";

function toggle(state?: boolean): void {
  const layout = getGlobalStates().layout;

  window[ApplicationNamespace].functions.changeGlobalStates("layout", {
    ...layout,
    "custom": state ?? !layout.custom,
  });
}

export const Layout = {
  toggle,
};