import { ApplicationName } from "@/constants/application.ts";
import General from "@/lib/general";
import type { LibraryArtifactsType } from "@/types/launcher/artifacts/library-artifacts.type.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  ArgumentReplacementsType,
} from "@/types/launcher/launch/argument-replacements.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchMetaType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function replaceLaunchArguments({
  auth,
  builtLaunchArguments,
  necessaries,
  versionMeta,
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
  "parsed"     : {
    "libraries": Array<MappedArtifactType>;
    "natives"  : Array<MappedArtifactType>;
    "logging"  : MappedArtifactType & {
      "argument": string;
    };
    "client"   : MappedArtifactType;
    "patches"  : LibraryArtifactsType;
    "mainClass": string;
  };
}): string {
  const { directories, instance } = necessaries;
  const assetIndexId: string = versionMeta?.assetIndex?.id ?? "";
  const replacements: ArgumentReplacementsType = {
    "assets_index_name"    : assetIndexId,
    "assets_root"          : directories.assets,
    "auth_access_token"    : auth.token,
    "auth_player_name"     : auth.username,
    "auth_session"         : "", // unknown
    "auth_uuid"            : auth.uuid,
    "auth_xuid"            : "", // 'only present in newer versions with Microsoft integration'
    "classpath"            : builtLaunchArguments.classPaths,
    "clientid"             : "", // 'Unknown, only present in newer versions'
    "game_assets"          : directories.assets,
    "game_directory"       : directories.instance,
    "launcher_name"        : ApplicationName,
    "launcher_version"     : General.getLauncherVersion(),
    "natives_directory"    : directories.natives,
    "quickPlayMultiplayer" : "", // 'The host of the multiplayer server'
    "quickPlayPath"        : "", // 'Where to output the logs files, relative to .minecraft'
    "quickPlayRealms"      : "", // 'The ID of the Minecraft Realms'
    "quickPlaySingleplayer": "", // 'The path to the singleplayer world'
    "resolution_height"    : instance.windowHeight.toString(),
    "resolution_width"     : instance.windowWidth.toString(),
    "user_properties"      : "", // 'older versions, doesn’t appear to be used in game'
    "user_type"            : auth.type, // 'msa', 'mojang', or 'offline' (?)
    "version_name"         : instance.version,
    "version_type"         : versionMeta?.type ?? "release",
  };
  const keysRegex: RegExp = new RegExp(
    Object
      .keys(replacements)
      .map(key => String.raw`\$\{${key}\}`)
      .join("|"),
    "g",
  );

  return builtLaunchArguments.toReplace
    .replace(keysRegex, matched => {
      const key = matched.slice(2, -1) as keyof ArgumentReplacementsType;

      return replacements[key];
    });
}
