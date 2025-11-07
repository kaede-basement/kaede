export const HookMappings = {
  "layout"          : "onLayoutChange",
  "pages"           : "onPagesChange",
  "logs"            : "onLogsChange",
  "sidebarItems"    : "onSidebarItemsChange",
  "contextMenuItems": "onContextMenuItemsChange",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;