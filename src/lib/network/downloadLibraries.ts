import type { Rule, Library, Classifier, Artifact } from "~/constants/schemas";
import { ArtifactSchema, ClassifiersSchema, LibrarySchema, RulesSchema } from "~/constants/schemas";
import { download as downloadFile } from "@tauri-apps/plugin-upload";
import getPlatform from "../helpers/getPlatform";
import { Libraries_DataFolder } from "~/constants/app";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { ArkErrors } from "arktype";
import getArch from "../helpers/getArch";


export default async function downloadLibraries(url: string): Promise<void> {
  const response: Response = await fetch(url);
  const json = await response?.json();
  const parsed = LibrarySchema.array()(json?.libraries);

  if (parsed instanceof ArkErrors) throw "Validation of libraries schema failed!\n" + parsed.summary;

  useQueries({
    "queries": parsed.map((library: Library) => ({
      "queryKey" : ["libs", library.name],
      "queryFn"  : async () => await download(library),
      "enabled"  : true,
    })),
  });
}

async function download(library: Library): Promise<void> {
  const rules = RulesSchema.array()(library.rules);

  if (rules instanceof ArkErrors) throw "Validation of rules schema failed!\n" + rules.summary;
  if (!await isAllowed(rules)) return;

  const { classifiers, artifact } = library.downloads;
  const classifiersParsed = ClassifiersSchema(classifiers);
  const artifactParsed = ArtifactSchema(artifact);

  if (classifiersParsed instanceof ArkErrors) {
    throw "Validation of classifiers schema failed!\n" + classifiersParsed.summary;
  }
  if (artifactParsed instanceof ArkErrors) {
    throw "Validation of artifact schema failed!\n" + artifactParsed.summary;
  }

  const native = await findNative(classifiersParsed);

  if (native) {
    await downloadFile(
      native.url,
      await join(await appLocalDataDir(), Libraries_DataFolder, native.path),
    );
  }
  if (artifact) {
    await downloadFile(
      artifact.url,
      await join(await appLocalDataDir(), Libraries_DataFolder, artifact.path),
    );
  }
}

async function isAllowed(rules: Rule[]): Promise<boolean> {
  const currentPlatform: string = await getPlatform();

  return !rules.some((rule: Rule) => {
    const isPlatformAllowed: boolean = rule.os?.name === currentPlatform || !rule.os?.name;
    const isActionDisallow: boolean = rule.action === "disallow";

    return isPlatformAllowed && isActionDisallow;
  });
}

async function findNative(classifier: Classifier): Promise<Artifact | undefined> {
  const currentPlatform: string = await getPlatform();
  const currentArch: string = await getArch();

  const keys: string[] = [
    `natives-${currentPlatform}-${currentArch}`,
    `natives-${currentPlatform}`,
  ];

  for (const key of keys) {
    const native = ArtifactSchema(classifier[key as keyof Classifier]);

    if (!(native instanceof ArkErrors)) return native;
  }

  return undefined;
}

