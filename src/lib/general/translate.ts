import English from "@/constants/english.json";
import { globalStates } from "@/states/global.ts";
import type { TranslationKey } from "@/types/translations/translations.type.ts";

export function translate(key: TranslationKey): string {
  return globalStates?.translations?.Messages?.[key] ?? English.Messages[key];
}
