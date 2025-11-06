export const Routes = {
  "Home"       : "home",
  "Library"    : "library",
  "Settings"   : "settings",
  "AddInstance": "add-instance",
  "None"       : "none",
} as const;
export const RouteItems = [
  {
    "Path": Routes.Home,
    "Icon": "i-lucide-home",
  },
  {
    "Path": Routes.Library,
    "Icon": "i-lucide-boxes",
  },
  {
    "Path": Routes.Settings,
    "Icon": "i-lucide-settings",
  },
] as const;