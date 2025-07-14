import type { Rule, Library } from "~/constants/schemas";
import { LibrarySchema, RulesSchema } from "~/constants/schemas";
import { z } from "zod";
import { download as downloadFile } from "@tauri-apps/plugin-upload";
import getPlatform from "../helpers/getPlatform";
import { Libraries_DataFolder } from "~/constants/app";
import { appLocalDataDir, join } from "@tauri-apps/api/path";

export default async function downloadLibraries(url: string): Promise<void> {
  const response: Response = await fetch(url);
  const json = await response?.json();
  const parsed = await z.array(LibrarySchema).parseAsync(json?.libraries);

  const results = useQueries({
    queries: parsed.map(library => ({
      queryKey: ["libs", library.name],
      queryFn : async () => await download(library),
      enabled : true,
    })),
  });
}

async function download(library: Library): Promise<void> {
  const platform: string = await getPlatform();
  const rules: Rule[] = await z.array(RulesSchema).parseAsync(library.rules);
  const rulePlatform: Rule | undefined = rules?.find((rule: Rule) => rule?.os?.name == platform);
  const ruleGlobal: Rule | undefined = rules?.find((rule: Rule) => !rule?.os?.name);

  if (rulePlatform?.action === "disallow") return;
  if (!rulePlatform && ruleGlobal?.action === "disallow") return;

  downloadFile(
    library.downloads.artifact.url,
    await join(await appLocalDataDir(), Libraries_DataFolder, library.downloads.artifact.path),
  );
}