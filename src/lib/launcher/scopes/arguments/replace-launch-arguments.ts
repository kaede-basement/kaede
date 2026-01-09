import { ApplicationName } from "@/constants/application.ts";
import ExtensionsManager from "@/lib/extensions-manager";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type {
  ArgumentAuthReplacementsType,
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type { ParsedMetaType } from "@/types/launcher/meta/parsed-meta.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function replaceLaunchArguments({
  auth,
  builtLaunchArguments,
  instanceId,
  necessaries,
  versionMeta,
  parsed,
  javaBinary,
}: {
  "auth": {
    "username": string;
    "token"   : string;
    "uuid"    : string;
    "type"    : string;
  };
  "builtLaunchArguments": {
    "toReplace" : string;
    "classPaths": string;
  };
  "instanceId" : string;
  "necessaries": PreLaunchInformationType;
  "versionMeta": SpecificPatchMetaType;
  "parsed"     : ParsedMetaType;
  "javaBinary" : string;
}): string {
  const { directories, instance } = necessaries;
  const assetIndexId: string = versionMeta?.assetIndex?.id ?? "";

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing replacements (without auth)");
  const replacements: ArgumentReplacementsType = {
    "assets_index_name"    : assetIndexId,
    "assets_root"          : directories.assets,
    "classpath"            : builtLaunchArguments.classPaths,
    // Present in newer versions
    "clientid"             : "",
    "game_assets"          : directories.assets,
    "game_directory"       : directories.instance,
    "launcher_name"        : ApplicationName,
    "launcher_version"     : General.getLauncherVersion(),
    "natives_directory"    : directories.natives,
    // 'The host of the multiplayer server'
    "quickPlayMultiplayer" : "",
    // 'Where to output the logs files, relative to .minecraft'
    "quickPlayPath"        : "",
    // 'The ID of the Minecraft Realms'
    "quickPlayRealms"      : "",
    // 'The path to the singleplayer world'
    "quickPlaySingleplayer": "",
    "resolution_height"    : instance.windowHeight.toString(),
    "resolution_width"     : instance.windowWidth.toString(),
    // Used by old versions
    "user_properties"      : JSON.stringify({
      "kaede": ["unknown"],
    }),
    // 'msa', 'mojang', or 'offline' (?)
    "user_type"   : auth.type,
    "version_name": instance.version,
    "version_type": versionMeta?.type ?? "release",
  };

  const beforeHooksResult: "continue" | string | undefined =
    ExtensionsManager.catchSyncResponseHooks<string>({
      "scope" : "onLaunchArgumentsReplace",
      "toPass": {
        auth,
        replacements,
        builtLaunchArguments,
        instanceId,
        necessaries,
        versionMeta,
        parsed,
        javaBinary,
      },
      "timing": "before",
    });

  if (beforeHooksResult !== "continue" && beforeHooksResult !== undefined) {
    return beforeHooksResult;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Building a replacements regex (without auth)");
  const keysRegex: RegExp = new RegExp(
    Object
      .keys(replacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    "Replacing placeholders in the launch command (without auth)",
  );
  const commandWithoutAuth: string = builtLaunchArguments.toReplace
    .replace(keysRegex, matched => {
      const key = matched.slice(2, -1) as keyof ArgumentReplacementsType;

      return replacements[key];
    });

  log.info(
    __PRE_BUNDLED_FILENAME__,
    "The launching command (auth data is hidden):",
    "\n" + javaBinary + " " + commandWithoutAuth,
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Initializing auth replacements");
  const authReplacements: ArgumentAuthReplacementsType = {
    "auth_access_token": auth.token,
    "auth_player_name" : auth.username,
    // Used in 1.6.4
    "auth_session"     : "none",
    "auth_uuid"        : auth.uuid,
    // 'Only present in newer versions with Microsoft integration'
    "auth_xuid"        : "",
  };

  const afterHooksResult: "continue" | string | undefined =
    ExtensionsManager.catchSyncResponseHooks<string>({
      "scope" : "onLaunchArgumentsReplace",
      "toPass": {
        auth,
        authReplacements,
        replacements,
        builtLaunchArguments,
        instanceId,
        necessaries,
        versionMeta,
        parsed,
        javaBinary,
      },
      "timing": "after",
    });

  if (afterHooksResult !== "continue" && afterHooksResult !== undefined) {
    return afterHooksResult;
  }

  log.debug(__PRE_BUNDLED_FILENAME__, "Building an auth replacements regex");
  const authKeysRegex: RegExp = new RegExp(
    Object
      .keys(authReplacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  log.debug(__PRE_BUNDLED_FILENAME__, "Replacing auth placeholders in the launch command");

  return commandWithoutAuth
    .replace(authKeysRegex, matched => {
      const key = matched.slice(2, -1) as keyof ArgumentAuthReplacementsType;

      return authReplacements[key];
    });
}
