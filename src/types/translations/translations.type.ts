import type { ComputedRef } from "vue";

import EnglishTranslations from "@/constants/english.json";

export type TranslationsType = typeof EnglishTranslations;
export type TranslationKey = keyof TranslationsType["Messages"];

export type TranslationsStateType = ComputedRef<TranslationsType>;
