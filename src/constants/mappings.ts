export const HookMappings = {
  "customLayout": "onCustomLayoutToggle",
  "page"        : "onRouteChange",
  "pageStates"  : "onPageStatesChange",
  "sidebarItems": "onSidebarItemsChange",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;