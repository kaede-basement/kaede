import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type { SpecificPatchLibraryType } from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseLibrary({
  necessaries,
  library,
  isMaven,
  patchUid,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
  "isMaven"    : boolean;
  "patchUid"   : string;
}): Required<MappedArtifactType> | false {
  const { directories, logPrefix } = necessaries;
  const descriptiveLogPrefix: string = patchUid + ":" + library?.name + ":" + logPrefix;
  const name: string | undefined = library?.name;
  const baseUrl: string | undefined = library?.url;
  const url: string | undefined = library?.downloads?.artifact?.url;
  const hash: string | undefined = library?.downloads?.artifact?.sha1;

  if (name === undefined) {
    log.warn(descriptiveLogPrefix, `The '${JSON.stringify(library)}' library is invalid`);

    return false;
  }

  const { "directory": relativeDirectory, file } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(
    directory,
    file,
  );

  // The 'com.mumfrey.liteloader' patch libraries only have the 'name' fields sometimes
  const isEmpty = baseUrl === undefined && library?.downloads === undefined;

  if (isEmpty) {
    log.warn(descriptiveLogPrefix, "The library is empty");

    return {
      "id"    : name,
      "status": "empty",
      "url"   : "",
      "hash"  : "ignore",
      "first" : false,
      directory,
      file,
      path,
    };
  }

  // The 'net.fabricmc.fabric-loader' patch libraries only have the 'name' and 'url' fields
  if (baseUrl !== undefined) {
    /*
     * For some reason, sometimes 'url' fields lack the '/' character at the end of the string
     *
     * Example:
     * {
     *   "name": "net.fabricmc:sponge-mixin:0.17.0+mixin.0.8.7",
     *   "url": "https://maven.fabricmc.net/"
     * },
     * {
     *   "name": "net.fabricmc:fabric-loader:0.18.4",
     *   "url": "https://maven.fabricmc.net"
     * }
     */
    const ensureSlash: string = baseUrl.endsWith("/") ? "" : "/";
    // 'net.fabricmc:fabric-loader:0.18.4'
    const urlPaths: Array<string> = name
      // '["net.fabricmc", "fabric-loader", "0.18.4"]'
      .split(":");
    // 'net.fabricmc'
    const groupPart: string | undefined = urlPaths.shift();

    if (!groupPart) {
      log.warn(descriptiveLogPrefix, "The library name is invalid");

      return false;
    }

    // 'net/fabricmc/fabric-loader/0.18.4'
    const urlPath: string = [
      // 'net/fabricmc'
      groupPart.split(".").join("/"),
      // '["fabric-loader", "0.18.4"]'
      ...urlPaths,
    ].join("/");
    const builtUrl: string = baseUrl + ensureSlash + urlPath + "/" + file;

    return {
      "id"    : name,
      "status": isMaven ? "mavenFile" : "library",
      "url"   : builtUrl,
      "hash"  : "ignore",
      "first" : false,
      directory,
      file,
      path,
    };
  }

  if (url === undefined || hash === undefined) {
    log.warn(descriptiveLogPrefix, "The library is invalid");

    return false;
  }

  return {
    "id"    : name,
    "status": isMaven ? "mavenFile" : "library",
    "first" : false,
    directory,
    file,
    url,
    path,
    hash,
  };
}
