export const HookMappings = {
  "customLayout": "onCustomLayoutToggle",
  "page"        : "onRouteChange",
  "pageStates"  : "onPageStatesChange",
  "sidebarItems": "__PLACEHOLDER_DO_NOT_TOUCH",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;