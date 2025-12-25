import { ApplicationName } from "@/constants/application.ts";
import General from "@/lib/general";
import type { InstanceStateType } from "@/types/application/instance-states.type.ts";
import type {
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type { DirectoriesType } from "@/types/launcher/launch/directories.type.ts";
import type { MetaMinecraftVersionType } from "@/types/launcher/meta/net-minecraft.type.ts";

export function replaceLaunchArguments({
  builtLaunchArguments,
  instance,
  versionMeta,
  directories,
}: {
  "builtLaunchArguments": string;
  "instance"            : InstanceStateType;
  "versionMeta"         : MetaMinecraftVersionType;
  "directories"         : DirectoriesType;
}): string {
  const replacements: ArgumentReplacementsType = {
    "assets_index_name"    : versionMeta.assetIndex.id,
    "assets_root"          : directories.assets,
    "auth_access_token"    : "",
    "auth_player_name"     : "",
    "auth_session"         : "",
    "auth_uuid"            : "",
    "auth_xuid"            : "",
    "classpath"            : "",
    "clientid"             : "",
    "game_assets"          : "",
    "game_directory"       : "",
    "launcher_name"        : ApplicationName,
    "launcher_version"     : General.getLauncherVersion(),
    "natives_directory"    : "",
    "quickPlayMultiplayer" : "",
    "quickPlayPath"        : "",
    "quickPlayRealms"      : "",
    "quickPlaySingleplayer": "",
    "resolution_height"    : "",
    "resolution_width"     : "",
    "user_properties"      : "",
    "user_type"            : "",
    "version_name"         : "",
    "version_type"         : "",
  };
  const keysRegex: RegExp = new RegExp(
    Object
      .keys(replacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  return builtLaunchArguments
    .replace(keysRegex, matched => {
      const key = matched.slice(2, -1) as keyof ArgumentReplacementsType;

      return replacements[key];
    });
}
