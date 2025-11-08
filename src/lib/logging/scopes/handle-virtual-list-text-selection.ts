export function handleVirtualListTextSelection(
  event: MouseEvent,
  isSelection: boolean,
  currentSelectionRange: [number, number] | undefined,
): [number, number] | "save" | undefined {
  if (!isSelection) {
    return undefined;
  }

  const initialTarget = event.target as HTMLSpanElement;

  if (!initialTarget?.id) {
    return "save";
  }

  const idValues = initialTarget.id.split("-");
  const extractedIndex = idValues[idValues.length - 1];

  if (!extractedIndex) {
    return undefined;
  }

  const parsedIndex = Number.parseInt(extractedIndex);

  if (Number.isNaN(parsedIndex)) {
    return undefined;
  }

  if (!currentSelectionRange) {
    return [parsedIndex, parsedIndex];
  }

  return [currentSelectionRange[0], parsedIndex];
}