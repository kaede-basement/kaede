import { DefaultLocale } from "@/constants/application.ts";
import EnglishTranslations from "@/constants/english.json";
import FileStructure from "@/constants/file-structure.ts";
import FileManager from "@/lib/file-manager";
import { publishText } from "@/lib/file-manager/publish-text.ts";
import { log } from "@/lib/logging/log.ts";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";
import type { TranslationsType } from "@/types/translations/translations.type.ts";

function effectiveLocale(locale: unknown): string {
  return typeof locale === "string" && locale.length > 0 && !(/[^a-zA-Z0-9_-]/).test(locale)
    ? locale
    : DefaultLocale;
}

function preloadedLocale(config: ParsedFile): string {
  const data = config.status === "loaded" ? config.data : undefined;

  return effectiveLocale(data && typeof data === "object" && "locale" in data && data.locale);
}

export async function getTranslations(properties?: Partial<{
  "baseDirectory"  : string;
  "selected"       : string;
  "isDefault"      : boolean;
  "parsedFile"     : ParsedFile;
  "preloadedConfig": ParsedFile;
}>): Promise<TranslationsType> {
  if (properties?.isDefault) {
    return EnglishTranslations;
  }

  const baseDirectory = properties?.baseDirectory ?? FileManager.getBaseDirectory();
  const selected = effectiveLocale(properties?.selected);
  const config = properties?.preloadedConfig;
  const parsedFile = config && preloadedLocale(config) !== selected
    ? undefined
    : properties?.parsedFile;

  if (parsedFile?.status === "corrupt") {
    const path = FileManager.join(
      baseDirectory, FileStructure.Folders.Translations.Path, selected + ".json",
    );

    await publishText(path, JSON.stringify(EnglishTranslations, null, 2)).catch(error => {
      log.warn(__PRE_BUNDLED_FILENAME__, "Failed to repair translations:", error);
    });

    return EnglishTranslations;
  }

  const parsedTranslations: unknown = parsedFile?.status === "loaded"
    ? parsedFile.data
    : await FileManager.handleJsonFile({
      baseDirectory,
      "path"           : [FileStructure.Folders.Translations.Path, selected + ".json"],
      "label"          : `/translations/${selected}.json`,
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
