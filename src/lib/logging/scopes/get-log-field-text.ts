import type { FieldTextType } from "@/types/application/log-field-text.type.ts";

export function getLogFieldText(input: string, toSearch: string): string | FieldTextType {
  const lowerCasedInput = input.toLowerCase();

  if (toSearch === "" || !lowerCasedInput.includes(toSearch)) {
    return input;
  }

  const occurrences = [
    ...lowerCasedInput.matchAll(new RegExp(toSearch, "g")),
  ];
  const noOccurrenceFields = [];
  const occurrenceExtractions = [];
  let previousIndex = 0;

  for (const occurrence of occurrences) {
    const occurrenceIndex = occurrence.index;

    noOccurrenceFields.push(input.slice(
      previousIndex,
      occurrenceIndex,
    ));
    occurrenceExtractions.push(input.slice(
      occurrenceIndex,
      occurrenceIndex + toSearch.length,
    ));

    previousIndex = occurrenceIndex + toSearch.length;
  }

  noOccurrenceFields.push(input.slice(previousIndex));

  return {
    "extractions": occurrenceExtractions,
    "fields"     : noOccurrenceFields,
  };
}