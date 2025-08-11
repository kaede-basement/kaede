import type { Rule, Library } from "~/constants/schemas";
import { download as downloadFile } from "@tauri-apps/plugin-upload";
import getPlatform from "../helpers/getPlatform";
import { Libraries_DataFolder } from "~/constants/app";
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { ArkErrors } from "arktype";


export default async function downloadLibraries(url: string): Promise<void> {
  const response: Response = await fetch(url);
  const json = await response?.json();
  // TODO: validate 'json?.libraries'
  const parsed: Library[] | ArkErrors = json?.libraries as Library[];

  if (parsed instanceof ArkErrors) {
    throw "Validation of libraries schema failed!";
  }

  useQueries({
    "queries": parsed.map((library: Library) => ({
      "queryKey" : ["libs", library.name],
      "queryFn"  : async () => await download(library),
      "enabled"  : true,
    })),
  });
}

async function download(library: Library): Promise<void> {
  const platform: string = await getPlatform();
  const rules: Rule[] = library.rules ?? [];
  const rulePlatform: Rule | undefined = rules?.find((rule: Rule) => rule?.os?.name == platform);
  const ruleGlobal: Rule | undefined = rules?.find((rule: Rule) => !rule?.os?.name);

  if (rulePlatform?.action === "disallow") return;
  if (!rulePlatform && ruleGlobal?.action === "disallow") return;

  downloadFile(
    library.downloads.artifact.url,
    await join(await appLocalDataDir(), Libraries_DataFolder, library.downloads.artifact.path),
  );
}
