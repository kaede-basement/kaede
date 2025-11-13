export const HookMappings = {
  "locale"          : "onLocaleChange",
  "fileSystem"      : "onFileSystemChange",
  "layout"          : "onLayoutChange",
  "pages"           : "onPagesChange",
  "logs"            : "onLogsChange",
  "sidebarItems"    : "onSidebarItemsChange",
  "contextMenuItems": "onContextMenuItemsChange",
  "development"     : "onDevelopmentChange",
} as const;
export const HookMappingKeys = Object.keys(HookMappings) as Array<keyof typeof HookMappings>;

export const HookResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;
