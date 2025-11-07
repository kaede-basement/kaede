import { ApplicationNamespace } from "@/constants/application.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { RouteType } from "@/types/application/route.type.ts";

function getGlobalStates(): GlobalStatesType {
  return window[ApplicationNamespace].functions.getGlobalStates();
}

export const LayoutStateHelper = {
  "Toggle": (state?: boolean): void => {
    const layout = getGlobalStates().layout;

    window[ApplicationNamespace].functions.changeGlobalStates("layout", {
      ...layout,
      "custom": state ?? !layout.custom,
    });
  },
};

export const PagesStateHelper = {
  "Navigate": (path: RouteType): void => {
    const pages = getGlobalStates().pages;

    window[ApplicationNamespace].functions.changeGlobalStates("pages", {
      ...pages,
      "current": path,
    });
  },
  "GetState": <Key extends keyof GlobalStatesType["pages"]["states"]>(
    key: Key,
  ): GlobalStatesType["pages"]["states"][Key] => {
    return getGlobalStates().pages.states[key];
  },
  "GetAllStates": (): GlobalStatesType["pages"]["states"] => {
    return getGlobalStates().pages.states;
  },
  "AddToState": <Key extends keyof GlobalStatesType["pages"]["states"]>(
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
  },
  "ReplaceState": <Key extends keyof GlobalStatesType["pages"]["states"]>(
    key: Key,
    value: GlobalStatesType["pages"]["states"][Key],
  ): void => {
    const pages = getGlobalStates().pages;
    const newStates = { ...pages.states, [key]: value };

    window[ApplicationNamespace].functions.changeGlobalStates("pages", {
      ...pages,
      "states": newStates,
    });
  },
};

export const LogsStateHelper = {
  "Toggle": <Key extends keyof GlobalStatesType["logs"]>(
    key: Key,
    state?: boolean,
  ): void => {
    const logs = getGlobalStates().logs;

    if (typeof logs[key] !== "boolean") {
      return;
    }

    const newLogs = {
      ...logs,
      [key]: state ?? !logs[key],
    };

    window[ApplicationNamespace].functions.changeGlobalStates("logs", newLogs);
  },
};