import type { Ref } from "vue";

import EnglishTranslations from "@/constants/english.json";
import ATLauncherIcon from "@/resources/ATLauncherIcon.svg";
import CraftingTableIcon from "@/resources/CraftingTableIcon.webp";
import CurseForgeIcon from "@/resources/CurseForgeIcon.webp";
import FTBIcon from "@/resources/FTBIcon.svg";
import ModrinthIcon from "@/resources/ModrinthIcon.webp";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";
import type { AccountType } from "@/types/configs/account.type.ts";
import type { LogLevelType } from "@/types/logging/log-level.type.ts";
import type {
  AccountActionCollectionType,
} from "@/types/ui/account-action.type.ts";
import type { TabSectionType } from "@/types/ui/tab-section.type.ts";

export const ApplicationName = "Kaede";
export const ApplicationRootID = "#app";

export const CustomFontFamily = "kaede-custom-font";

export const DefaultLocale = "en";
export const DefaultLocaleName = EnglishTranslations.Info.Name;

export const TrustedHashesURL =
  "https://raw.githubusercontent.com/kaede-basement/trusted-extensions/refs/heads/main/HASHES.json";

export const TranslationsContextKey = Symbol();
export const AuthOneTimeFetchContextKey = Symbol();
export const AuthStatesContextKey = Symbol();
export const LaunchStatesContextKey = Symbol();
export const InstanceLogsContextKey = Symbol();
export const LaunchInstanceContextKey = Symbol();
export const CloseInstanceContextKey = Symbol();
export const LaunchInstanceStatusesContextKey = Symbol();

/*
 * JavaScript allows 'AsyncFunction' constructors.
 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
 */
export const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;

export const CSSThemeExtensions = {
  "Enabled" : ".css",
  "Disabled": ".css.disabled",
} as const;

export const ContextMenu: {
  "contextMenu"?: Ref<{
    "opened": boolean;
    "x"     : number;
    "y"     : number;
  }>;
  "show" : (event: MouseEvent) => void;
  "close": () => void;
} = {

  /* These fields will be overwritten later */
  "show" : () => {},
  "close": () => {},
};

export const ActionKeys = {
  "AccountsRefresh"          : "accounts.refresh",
  "AccountsCopyUUID"         : "accounts.copy-uuid",
  "AccountsRemove"           : "accounts.remove",
  "ContextMenuSoftReload"    : "context-menu.soft-reload",
  "ContextMenuHardReload"    : "context-menu.hard-reload",
  "ContextMenuProcessReload" : "context-menu.process-reload",
  "ContextMenuSafeMode"      : "context-menu.safe-mode",
  "ContextMenuLogs"          : "context-menu.logs",
  "ContextMenuMinecraftLogs" : "context-menu.minecraft-logs",
  "ContextMenuRootFolder"    : "context-menu.root-folder",
  "ContextMenuInstanceFolder": "context-menu.instance-folder",
  "SidebarRouteChange"       : "sidebar.route-change",
  "LaunchOptionWithoutSHA1"  : "launch-option.without-sha1",
  "LaunchOptionGlobalJava"   : "launch-option.global-java",
} as const;
export type ActionKeyType = (typeof ActionKeys)[keyof typeof ActionKeys];

export const AccountActions: AccountActionCollectionType = [
  {
    "icon"    : "i-lucide-refresh-cw",
    "label"   : "profile.accounts.refresh",
    // Offline accounts don't need to be refreshed
    "disabled": (account: AccountType): boolean => account.msa === null,
    "action"  : ActionKeys.AccountsRefresh,
  },
  {
    "icon"  : "i-lucide-copy",
    "label" : "profile.accounts.copy-uuid",
    "action": ActionKeys.AccountsCopyUUID,
  },
  {
    "icon"  : "i-lucide-trash-2",
    "label" : "profile.accounts.remove",
    "action": ActionKeys.AccountsRemove,
  },
];

export const InstanceCreationSections: Array<TabSectionType> = [
  {
    "id"   : "clean-minecraft",
    "name" : "Clean",
    "image": CraftingTableIcon,
  },
  {
    "id"   : "modrinth",
    "name" : "Modrinth",
    "image": ModrinthIcon,
  },
  {
    "id"   : "ftb-legacy",
    "name" : "FTB Legacy",
    "image": FTBIcon,
  },
  {
    "id"   : "curseforge",
    "name" : "CurseForge",
    "image": CurseForgeIcon,
  },
  {
    "id"   : "atlauncher",
    "name" : "ATLauncher",
    "image": ATLauncherIcon,
  },
];
export const ContextMenuItems: GlobalStatesType["contextMenuItems"] = [
  {
    "name"    : "Restart",
    "icon"    : "i-lucide-rotate-ccw",
    "children": [
      {
        "name"  : "UI (Soft Reload)",
        "icon"  : "i-lucide-panel-top",
        "action": ActionKeys.ContextMenuSoftReload,
      },
      {
        "name"  : "WebView (Hard Reload)",
        "icon"  : "i-lucide-app-window",
        "action": ActionKeys.ContextMenuHardReload,
      },
      {
        "name"  : "Application",
        "icon"  : "i-lucide-cpu",
        "action": ActionKeys.ContextMenuProcessReload,
      },
      {
        "name"  : "Safe Mode",
        "icon"  : "i-lucide-shield-check",
        "action": ActionKeys.ContextMenuSafeMode,
      },
    ],
  },
  "divider",
  {
    "name"  : "Show Kaede Logs",
    "icon"  : "i-lucide-bug",
    "action": ActionKeys.ContextMenuLogs,
  },
  {
    "name"  : "Show Minecraft Logs",
    "icon"  : "i-lucide-box",
    "action": ActionKeys.ContextMenuMinecraftLogs,
  },
  "divider",
  {
    "name"  : "Open Root Folder",
    "icon"  : "i-lucide-folder",
    "action": ActionKeys.ContextMenuRootFolder,
  },
  {
    "name"  : "Open Instance Folder",
    "icon"  : "i-lucide-box",
    "action": ActionKeys.ContextMenuInstanceFolder,
  },
];
export const LaunchOptionItems: Array<{
  "label" : string;
  "action": ActionKeyType;
}> = [
  {
    "label" : "Launch without SHA1 checks",
    "action": ActionKeys.LaunchOptionWithoutSHA1,
  },
  {
    "label" : "Launch with global Java",
    "action": ActionKeys.LaunchOptionGlobalJava,
  },
];

export const HookResponseStatus = {
  "Stop"    : "stop",
  "Continue": "continue",
} as const;
export const ExtraHookResponseStatus = {
  "ContinueLoop": "continue-hooks-loop",
} as const;

export const LogKindColors: Record<"time" | "message", string> = {
  "time"   : "text-neutral-400",
  "message": "text-neutral-300",
};
export const LogLevelColors: Record<LogLevelType, string> = {
  "TRACE": "text-neutral-500",
  "DEBUG": "text-neutral-300",
  "INFO" : "text-blue-300",
  "WARN" : "text-orange-300",
  "ERROR": "text-red-300",
};

export default {
  AsyncFunction,
  ApplicationName,
  ApplicationRootID,
  CustomFontFamily,
  DefaultLocale,
  DefaultLocaleName,
  TrustedHashesURL,
  TranslationsContextKey,
  AuthOneTimeFetchContextKey,
  AuthStatesContextKey,
  LaunchStatesContextKey,
  InstanceLogsContextKey,
  LaunchInstanceContextKey,
  CloseInstanceContextKey,
  LaunchInstanceStatusesContextKey,
  CSSThemeExtensions,
  ContextMenu,
  AccountActions,
  InstanceCreationSections,
  ContextMenuItems,
  LaunchOptionItems,
  HookResponseStatus,
  ExtraHookResponseStatus,
  LogKindColors,
  LogLevelColors,
} as const;
