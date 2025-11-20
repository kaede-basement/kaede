import GlobalStateHelpers from "@/lib/global-state-helpers";

function toggle(state?: boolean): void {
  const layout = GlobalStateHelpers.get().layout;

  GlobalStateHelpers.change("layout", {
    ...layout,
    "custom": state ?? !layout.custom,
  });
}

export const Layout = {
  toggle,
};