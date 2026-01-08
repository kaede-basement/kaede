import EnglishTranslations from "@/constants/english.json";
import { FileStructure } from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export async function getTranslations(baseDirectory: string): Promise<TranslationsType> {
  const parsedTranslations: unknown = await General.handleJsonFile({
    baseDirectory,
    "path"           : [FileStructure.Files.Translations],
    "label"          : FileStructure.Files.Translations,
    "getDefaultValue": async (): Promise<TranslationsType> => (EnglishTranslations),
  });

  log.debug("get-translations.ts", "Shallowly validating the parsed translations file");

  if (typeof parsedTranslations !== "object" || parsedTranslations === null) {
    log.info("The provided translations are invalid");

    return EnglishTranslations;
  }

  /*
   * The parsed translations object is indeed an object;
   * in the worst case a user will just see the 'undefined' values everywhere.
   */
  return parsedTranslations as TranslationsType;
}
