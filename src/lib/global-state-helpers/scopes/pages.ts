import GlobalStateHelpers from "@/lib/global-state-helpers";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const navigate = (path: RouteType): void => {
  const pages = GlobalStateHelpers.get().pages;

  GlobalStateHelpers.change("pages", {
    ...pages,
    "current": path,
  });
};
const getState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
): GlobalStatesType["pages"]["states"][Key] => {
  return GlobalStateHelpers.get().pages.states[key];
};
const getAllStates = (): GlobalStatesType["pages"]["states"] => {
  return GlobalStateHelpers.get().pages.states;
};
const addToState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = GlobalStateHelpers.get().pages;
  const newStates = { ...pages.states };

  newStates[key] = {
    ...newStates[key],
    ...value,
  };

  GlobalStateHelpers.change("pages", {
    ...pages,
    "states": newStates,
  });
};
const replaceState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = GlobalStateHelpers.get().pages;
  const newStates = { ...pages.states, [key]: value };

  GlobalStateHelpers.change("pages", {
    ...pages,
    "states": newStates,
  });
};

export const Pages = {
  navigate,
  getState,
  getAllStates,
  addToState,
  replaceState,
};