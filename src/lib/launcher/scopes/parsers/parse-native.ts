import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/parsers/normalize-artifact-path.ts";
import { unifyPlatformWithArch } from "@/lib/launcher/scopes/parsers/unify-platform-with-arch.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { MappedArtifactType } from "@/types/launcher/artifacts/mapped-artifact.type.ts";
import type {
  PreLaunchInformationType,
} from "@/types/launcher/meta/pre-launch-information.type.ts";
import type {
  SpecificPatchClassifierKeyType,
  SpecificPatchClassifiersType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";

export function parseNative({
  necessaries,
  library,
}: {
  "necessaries": PreLaunchInformationType;
  "library"    : SpecificPatchLibraryType;
}): MappedArtifactType | false {
  const { directories, platform, arch } = necessaries;
  const classifiers: SpecificPatchClassifiersType | undefined = library?.downloads?.classifiers;
  const name: string | undefined = library?.name;
  const newFormattedUrl: string | undefined = library?.downloads?.artifact?.url;

  if (name === undefined) {
    log.warn(`The '${name}' native is invalid`);

    return false;
  }

  const { "directory": relativeDirectory, file, classifier } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    directories.libraries,
    relativeDirectory,
  );
  const path: string = General.cachedJoin(directory, file);

  // New natives format does not have a 'classifiers' field
  if (classifiers === undefined) {
    const hash: string | undefined = library?.downloads?.artifact?.sha1;

    if (newFormattedUrl === undefined || hash === undefined) {
      log.warn(`The '${name}' native is invalid`);

      return false;
    }

    const artifact: MappedArtifactType = {
      directory,
      file,
      path,
      hash,
      "url": newFormattedUrl,
    };

    if (classifier === undefined) {
      return artifact;
    }

    const {
      "platform": classifierPlatform,
      "arch"    : classifierArch,
    } = unifyPlatformWithArch(classifier);
    const isPlatformCompatible: boolean = classifierPlatform === platform;
    const isArchCompatible: boolean =
      classifierArch === "any" ||
      classifierArch === arch;

    if (isPlatformCompatible && isArchCompatible) {
      return artifact;
    }

    log.debug(`The '${name}' native is not compatible`);

    return false;
  }

  for (const [currentClassifier, { sha1, "url": nativesUrl }] of Object.entries(classifiers)) {
    const {
      "platform": classifierPlatform,
      "arch"    : classifierArch,
    } = unifyPlatformWithArch(currentClassifier as SpecificPatchClassifierKeyType);
    const isPlatformCompatible: boolean = classifierPlatform === platform;
    const isArchCompatible: boolean =
      classifierArch === "any" ||
      classifierArch === arch;

    if (!isPlatformCompatible || !isArchCompatible) {
      continue;
    }

    const suffix = `-natives-${platform === "macos" ? "osx" : platform}`;
    const currentNaming: Array<string> = file.split(".");

    currentNaming.pop();

    const requiredName: string =
      currentNaming.join(".") +
      suffix +
      ".jar";
    const updatedPath: string = General.cachedJoin(directory, requiredName);

    return {
      "directory": directory,
      "file"     : requiredName,
      "path"     : updatedPath,
      "url"      : nativesUrl,
      "hash"     : sha1,
    };
  }

  log.debug(`The '${name}' native is not compatible`);

  return false;
}
