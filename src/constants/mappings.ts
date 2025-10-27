export const HookMappings = {
  "customLayout"    : "onCustomLayoutToggle",
  "page"            : "onRouteChange",
  "pageStates"      : "onPageStatesChange",
  "showLogs"        : "onLogViewerToggle",
  "sidebarItems"    : "onSidebarItemsChange",
  "contextMenuItems": "onContextMenuItemsChange",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;