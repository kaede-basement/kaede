import EnglishTranslations from "@/constants/english.json";

export type TranslationsType = typeof EnglishTranslations;
export type TranslationKey = keyof TranslationsType["Messages"];
