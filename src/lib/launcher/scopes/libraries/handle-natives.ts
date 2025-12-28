import General from "@/lib/general";
import { normalizeArtifactPath } from "@/lib/launcher/scopes/normalize-artifact-path.ts";
import type { MappedArtifactType } from "@/types/launcher/libraries/mapped-artifact.type.ts";
import type {
  SpecificPatchClassifiersType,
  SpecificPatchLibraryType,
} from "@/types/launcher/meta/specific-patch-meta.type.ts";
import type { PreLaunchInformationType } from "@/types/launcher/pre-launch-information.type.ts";

function mapClassifier(
  name: string,
  platform: PreLaunchInformationType["platform"],
  url: string,
  librariesDirectory: string,
): MappedArtifactType {
  const { file, "directory": relativeDirectory } = normalizeArtifactPath(name);
  const directory: string = General.cachedJoin(
    librariesDirectory,
    relativeDirectory,
  );
  const suffix = `-natives-${platform === "macos" ? "osx" : platform}`;
  const naming: Array<string> = file.split(".");

  naming.pop();

  const fileName: string =
    naming.join(".") +
    suffix +
    ".jar";

  return {
    "file"     : fileName,
    "directory": directory,
    "url"      : url,
    "path"     : General.cachedJoin(
      directory,
      fileName,
    ),
  };
}

export function handleNatives({
  necessaries,
  libraries,
}: {
  "necessaries": PreLaunchInformationType;
  "libraries"  : Array<SpecificPatchLibraryType>;
}): Array<MappedArtifactType> {
  const { directories, platform, arch } = necessaries;
  const natives: Array<MappedArtifactType> = [];

  for (const library of libraries) {
    const name: string | undefined = library?.name;
    const classifiers: SpecificPatchClassifiersType | undefined = library?.downloads?.classifiers;

    if (name === undefined || classifiers === undefined) {
      continue;
    }

    classifierLoop: for (const [classifier, { url }] of Object.entries(classifiers)) {
      const key = classifier as keyof SpecificPatchClassifiersType;
      const mappedNative: MappedArtifactType = mapClassifier(
        name,
        platform,
        url,
        directories.libraries,
      );

      switch (key) {
        case "natives-linux":
        case "natives-linux-${arch}": {
          if (platform !== "linux") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
        case "natives-osx":
        case "natives-osx-${arch}": {
          if (platform !== "macos") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
        case "natives-windows":
        case "natives-windows-${arch}": {
          if (platform !== "windows") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
        case "natives-linux-arm32": {
          if (platform !== "linux" && arch !== "arm32") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
        case "natives-linux-arm64": {
          if (platform !== "linux" && arch !== "arm64") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
        case "natives-osx-arm64": {
          if (platform !== "macos" && arch !== "arm64") {
            break;
          }

          natives.push(mappedNative);

          break classifierLoop;
        }
      }
    }
  }

  return natives;
}
