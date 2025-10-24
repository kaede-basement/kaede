export const HookMappings = {
  "customLayout": "onCustomLayoutToggle",
  "page"        : "onRouteChange",
  "pageStates"  : "onPageStatesChange",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;