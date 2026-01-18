import type {
  PatchDependencyType,
  PatchUIDType,
  PatchVariantType,
} from "@/types/launcher/meta/patch-index.type.ts";

export type SpecificPatchRuntimeChecksumType = {
  "hash": string;
  "type": string;
};
export type SpecificPatchRuntimeVersionType = {
  "major"   : number;
  "minor"   : number;
  "security": number;
  "build"  ?: number;
  "name"   ?: string;
};
export type SpecificPatchRuntimeDownloadType = "archive" | "manifest";
export type SpecificPatchRuntimePackageType = "jre";
export type SpecificPatchClassifierOSType =
  "windows-aarch_64" | "windows-x86_64" |
  "linux-aarch_64" | "linux-x86_64" |
  "osx-aarch_64" | "osx-x86_64";
export type SpecificPatchRuntimeOSType =
  "linux-arm64" |
  "linux-x64" |
  "windows-arm64" |
  "windows-x64" |
  "mac-os-arm64" |
  "mac-os-x64";
export type SpecificPatchLibraryOSNameType =
  "linux" |
  "linux-arm32" |
  "linux-arm64" |
  "windows" |
  "windows-arm32" |
  "windows-arm64" |
  "osx-arm64" |
  "osx";
export type SpecificPatchRuntimeVendorType = "azul" | "eclipse";
export type SpecificPatchRuntimeType = {
  "checksum"    : SpecificPatchRuntimeChecksumType;
  "downloadType": SpecificPatchRuntimeDownloadType;
  "name"        : string;
  "packageType" : SpecificPatchRuntimePackageType;
  "releaseTime" : string;
  "runtimeOS"   : SpecificPatchRuntimeOSType;
  "url"         : string;
  "vendor"      : SpecificPatchRuntimeVendorType;
  "version"     : SpecificPatchRuntimeVersionType;
};
export type SpecificPatchArtifactType = {
  "sha1" : string;
  "size" : number;
  "url"  : string;
  "id"  ?: string;
  "path"?: string;
};
export type SpecificPatchClassifierKeyType =
  "natives-linux" |
  "natives-linux-${arch}" |
  "natives-linux-arm32" |
  "natives-linux-arm64" |
  "natives-osx" |
  "natives-osx-${arch}" |
  "natives-osx-arm64" |
  "natives-windows" |
  "natives-windows-${arch}" |
  // But there is already 'natives-osx' ?????
  "natives-macos" |
  "natives-macos-${arch}" |
  "natives-macos-arm64" |
  // THIS THING ALSO EXISTS WHAT
  "natives-windows-32" |
  // I am tired of seeing absolutely random shit, so the next ones are made up by me
  "natives-windows-64" |
  "natives-windows-arm32" |
  "natives-windows-arm64" |
  "natives-windows-x64" |
  "natives-windows-x86" |
  "natives-windows-x86_64" |
  "natives-linux-32" |
  "natives-linux-64" |
  "natives-linux-x64" |
  "natives-linux-x86" |
  "natives-linux-x86_64" |
  "natives-osx-32" |
  "natives-osx-64" |
  "natives-osx-x64" |
  "natives-osx-x86" |
  "natives-osx-x86_64" |
  "natives-macos-32" |
  "natives-macos-64" |
  "natives-macos-x64" |
  "natives-macos-x86" |
  "natives-macos-x86_64";
export type SpecificPatchClassifiersType = Record<
  SpecificPatchClassifierKeyType,
  SpecificPatchArtifactType
>;
export type SpecificPatchLibraryDownloadsType = {
  "artifact"   ?: SpecificPatchArtifactType;
  "classifiers"?: SpecificPatchClassifiersType;
};
export type SpecificPatchLibraryActionType = "allow" | "disallow";
export type SpecificPatchLibraryOSType = {
  "name": SpecificPatchLibraryOSNameType;
};
export type SpecificPatchLibraryRuleType = {
  "action": SpecificPatchLibraryActionType;
  "os"   ?: SpecificPatchLibraryOSType;
};
export type SpecificPatchLibraryExtractType = {
  // For example, ["META-INF/"]
  "exclude": Array<string>;
};
export type SpecificPatchLibraryNativesType = Partial<
  Record<
    SpecificPatchLibraryOSNameType,
    string | undefined
  >
>;
export type SpecificPatchLibraryType = {
  "name"      : string;
  "downloads"?: SpecificPatchLibraryDownloadsType;
  "extract"  ?: SpecificPatchLibraryExtractType;
  "natives"  ?: SpecificPatchLibraryNativesType;
  "rules"    ?: Array<SpecificPatchLibraryRuleType>;
  "url"      ?: string;
  "MMC-hint" ?: string;
};
export type SpecificPatchAssetIndexType = {
  "id"        : string;
  "sha1"      : string;
  "size"      : number;
  "url"       : string;
  "totalSize"?: number;
};
export type SpecificPatchLoggingType = {
  "argument": string;
  "file"    : SpecificPatchAssetIndexType;
  "type"    : string;
};
export type SpecificPatchMainJarType = {
  "downloads": {
    "artifact": {
      "sha1": string;
      "size": number;
      "url" : string;
    };
  };
  "name": string;
};
export type SpecificPatchMetaType = {
  // Currently, equals to one
  "formatVersion": number;

  // A human-readable name of the patch
  "name": string;

  /*
   * The version release time in the ISO 8601 string format.
   * Missing in custom patches, i.e. 'org.mcphackers.launchwrapper'
   */
  "releaseTime"?: string;

  // A unique identifier of the patch. As of now, can be 12 different string literals
  "uid": PatchUIDType;

  // A version string, e.g. '26.1-snapshot-2'
  "version": string;

  /*
   * All the next fields could be missing.
   *
   * Perhaps, these are Java agents.
   * Specified at https://github.com/PrismLauncher/meta/blob/main/meta/model/__init__.py#L342
   */
  "+agents"?: Array<Partial<{ "argument": string }>>;

  /*
   * Should be an array of needed libraries for this patch.
   * However, there is no way to surely tell the differences between the 'libraries' field
   */
  "+libraries"?: Array<SpecificPatchLibraryType>;

  /*
   * This field contains a list of unique flags Prism Launcher uses when launching.
   *
   * So far, I have encountered next values:
   * - 'legacyLaunch'       // Appears to indicate the use of a legacy Java applet launcher in Prism
   * - 'XR:Initial'         // Related to the Mojang compliance level
   * - 'FirstThreadOnMacOS' // Tells to use the '-XstartOnFirstThread' JVM argument on macOS
   * - 'legacyServices'     // Perhaps, it is related to auth (?)
   * - 'texturepacks'       // Shows that the version supports texture packs (?)
   * - 'no-texturepacks'    // Shows that the version does not support texture packs (?)
   *
   * There is also another format of traits, i.e. 'feature:*'.
   * They are usually present in newer versions. For example:
   * - 'feature:is_quick_play_singleplayer'
   * - 'feature:is_quick_play_multiplayer'
   *
   * Other possible values that I have not encountered:
   * - 'legacyFML'
   */
  "+traits"?: Array<string>;

  /*
   * An array of tweak classes to pass to the game arguments.
   * For example, the ['com.mumfrey.liteloader.launch.LiteLoaderTweaker', 'another_tweaker']
   * will be passed as
   * '--tweakClass com.mumfrey.liteloader.launch.LiteLoaderTweaker --tweakClass another_tweaker'
   */
  "+tweakers"?: Array<string>;

  /*
   * An array of JVM arguments to pass to your JVM arguments.
   * So far, I have encountered next values:
   * - '-Djava.util.Arrays.useLegacyMergeSort=true' // Present in ancient versions of Minecraft
   */
  "+jvmArgs"?: Array<string>;

  // Seem to equal to the Mojang API response format. Points to the Minecraft assets index JSON file
  "assetIndex"?: SpecificPatchAssetIndexType;

  // An array of Java major versions that are compatible with the patch
  "compatibleJavaMajors"?: Array<number>;

  /*
   * I do not remember where I saw this field.
   * However, it looks like it might represent the compatible Java vendor name
   */
  "compatibleJavaName"?: string;

  // An array of conflicting patches. Usually present in 'org.lwjgl' and 'org.lwjgl3'
  "conflicts"?: Array<PatchDependencyType>;

  /*
   * An array of needed libraries for this patch.
   * Seems to be the most complex part of Minecraft launching
   */
  "libraries"?: Array<SpecificPatchLibraryType>;

  /*
   * The logging configuration file to provide to log4j.
   * Stored in '/assets/log_configs/', alongside with '/assets/indexes/' and '/assets/objects/'
   */
  "logging"?: SpecificPatchLoggingType;

  // The main class to call in the execution of java
  "mainClass"?: string;

  // Points to the Minecraft client jar
  "mainJar"?: SpecificPatchMainJarType;

  /*
   * An array of needed libraries for this patch that should not be included in classpaths.
   * However, if a library is specified both in 'mavenFiles' and 'libraries',
   * it should be included in classpaths
   */
  "mavenFiles"?: Array<SpecificPatchLibraryType>;

  /*
   * A string with the game arguments. These arguments have placeholders that should be replaced,
   * such as '--username ${auth_player_name}', where '${auth_player_name}' is the player name.
   *
   * Some placeholders might not be replaced, and Minecraft will still launch.
   * Others always require to be replaced. One such case is the '${user_properties}' placeholder
   * that has an unknown purpose, yet requires to be a stringified version
   * of a JSON object with... random values?
   */
  "minecraftArguments"?: string;

  // Deprecated. Used to help to sort patches, apparently
  "order"?: number;

  // An array of dependencies of this patch. Can go three levels deep
  "requires"?: Array<PatchDependencyType>;

  // An array of runtimes to download. Used by Java patches, i.e. 'com.azul.java'
  "runtimes"?: Array<SpecificPatchRuntimeType>;

  // Used not only in the 'net.minecraft' patches, but in others too
  "type"?: PatchVariantType;

  // No clue. Present in 'net.fabricmc.intermediary'
  "volatile"?: boolean;
};
