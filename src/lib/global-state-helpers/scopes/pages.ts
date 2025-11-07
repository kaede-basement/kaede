import { ApplicationNamespace } from "@/constants/application.ts";
import { getGlobalStates } from "@/lib/global-state-helpers/scopes/get-global-states.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";

const navigate = (path: RouteType): void => {
  const pages = getGlobalStates().pages;

  window[ApplicationNamespace].functions.changeGlobalStates("pages", {
    ...pages,
    "current": path,
  });
};
const getState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
): GlobalStatesType["pages"]["states"][Key] => {
  return getGlobalStates().pages.states[key];
};
const getAllStates = (): GlobalStatesType["pages"]["states"] => {
  return getGlobalStates().pages.states;
};
const addToState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = getGlobalStates().pages;
  const newStates = { ...pages.states };

  newStates[key] = {
    ...newStates[key],
    ...value,
  };

  window[ApplicationNamespace].functions.changeGlobalStates("pages", {
    ...pages,
    "states": newStates,
  });
};
const replaceState = <Key extends keyof GlobalStatesType["pages"]["states"]>(
  key: Key,
  value: GlobalStatesType["pages"]["states"][Key],
): void => {
  const pages = getGlobalStates().pages;
  const newStates = { ...pages.states, [key]: value };

  window[ApplicationNamespace].functions.changeGlobalStates("pages", {
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