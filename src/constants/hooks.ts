export const HookMappings = {
  "translations"    : "onTranslationsChange",
  "fileSystem"      : "onFileSystemChange",
  "layout"          : "onLayoutChange",
  "pages"           : "onPagesChange",
  "logs"            : "onLogsChange",
  "sidebarItems"    : "onSidebarItemsChange",
  "contextMenuItems": "onContextMenuItemsChange",
  "development"     : "onDevelopmentChange",
  "misc"            : "onMiscChange",
  "minecraft"       : "onMinecraftChange",
  "instances"       : "onInstancesChange",
} as const;

export const HookResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;
