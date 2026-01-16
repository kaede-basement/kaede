import EnglishTranslations from "@/constants/english.json";
import FileStructure from "@/constants/file-structure.ts";
import General from "@/lib/general";
import { log } from "@/lib/logging/scopes/log.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

export async function getTranslations(
  baseDirectory: string,
  selected: string | undefined,
  isDefault?: boolean,
): Promise<TranslationsType> {
  if (isDefault) {
    return EnglishTranslations;
  }

  const parsedTranslations: unknown = await General.handleJsonFile({
    baseDirectory,
    "path"           : [FileStructure.Folders.Translations.Path, selected + ".json"],
    "label"          : `/cache/${selected}.json`,
    "getDefaultValue": async (): Promise<TranslationsType> => (EnglishTranslations),
  });

  log.debug(__PRE_BUNDLED_FILENAME__, "Shallowly validating the parsed translations file");

  if (typeof parsedTranslations !== "object" || parsedTranslations === null) {
    log.info(__PRE_BUNDLED_FILENAME__, "The provided translations are invalid");

    return EnglishTranslations;
  }

  /*
   * The parsed translations object is indeed an object;
   * in the worst case a user will just see the 'undefined' values everywhere.
   */
  return parsedTranslations as TranslationsType;
}
