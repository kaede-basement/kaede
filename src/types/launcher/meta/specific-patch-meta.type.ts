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
  "natives-osx-arm32" |
  "natives-osx-x64" |
  "natives-osx-x86" |
  "natives-osx-x86_64";
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
  "downloads": SpecificPatchLibraryDownloadsType;
  "name"     : string;
};
export type SpecificPatchMetaType = {
  "formatVersion"        : number;
  "name"                 : string;
  "releaseTime"          : string;
  "uid"                  : PatchUIDType;
  "version"              : string;
  "+agents"             ?: Array<Partial<{ "argument": string }>>;
  "+traits"             ?: Array<string>;
  "+tweakers"           ?: Array<string>;
  "+jvmArgs"            ?: Array<string>;
  "assetIndex"          ?: SpecificPatchAssetIndexType;
  "compatibleJavaMajors"?: Array<number>;
  "compatibleJavaName"  ?: string;
  "conflicts"           ?: Array<PatchDependencyType>;
  "libraries"           ?: Array<SpecificPatchLibraryType>;
  "logging"             ?: SpecificPatchLoggingType;
  "mainClass"           ?: string;
  "mainJar"             ?: SpecificPatchMainJarType;
  "mavenFiles"          ?: Array<SpecificPatchLibraryType>;
  "minecraftArguments"  ?: string;
  "order"               ?: number;
  "requires"            ?: Array<PatchDependencyType>;
  "runtimes"            ?: Array<SpecificPatchRuntimeType>;
  "type"                ?: PatchVariantType;
  "volatile"            ?: boolean;
};
