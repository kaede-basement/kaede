import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { ConfigType } from "@/types/application/config.type.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

function toggle(state?: ConfigType["layout"]["custom"]): void {
  const layout = GlobalStateHelpers.get().layout;

  if (state === undefined && typeof layout.custom !== "boolean") {
    return;
  }

  GlobalStateHelpers.change("layout", {
    ...layout,
    // Now either 'state' exists or 'layout.custom' is boolean
    "custom": state ?? !layout.custom,
  });
}
function overrideProperties(
  key: "background" | "sidebar",
  input: Partial<GlobalStatesType["layout"]["background" | "sidebar"]>,
): void {
  const layout = GlobalStateHelpers.get().layout;

  GlobalStateHelpers.change("layout", {
    ...layout,
    [key]: {
      ...layout[key],
      ...input,
    },
  });
}

export const Layout = {
  toggle,
  "overrideBackground": (input: Partial<GlobalStatesType["layout"]["background"]>): void => {
    overrideProperties("background", input);
  },
  "overrideSidebar": (input: Partial<GlobalStatesType["layout"]["sidebar"]>): void => {
    overrideProperties("sidebar", input);
  },
};