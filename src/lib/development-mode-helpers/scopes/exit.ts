import GlobalStateHelpers from "@/lib/global-state-helpers";

export function exit(): void {
  GlobalStateHelpers.change("development", null);
}
