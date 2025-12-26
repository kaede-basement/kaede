export const HookMappings = {
  "translations"    : "onTranslationsChange",
  "layout"          : "onLayoutChange",
  "pages"           : "onPagesChange",
  "logs"            : "onLogsChange",
  "sidebarItems"    : "onSidebarItemsChange",
  "contextMenuItems": "onContextMenuItemsChange",
  "development"     : "onDevelopmentChange",
  "misc"            : "onMiscChange",
  "minecraft"       : "onMinecraftChange",
  "extensions"      : "onExtensionsChange",
} as const;

export const HookResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;
export const ExtraHookResponseStatus = {
  "ContinueLoop": "continue-hooks-loop",
} as const;
