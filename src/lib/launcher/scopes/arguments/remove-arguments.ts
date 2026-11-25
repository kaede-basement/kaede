export function removeArguments(values: Array<string>, removals: Array<string> = []): void {
  for (let index = 0; index < removals.length; index++) {
    const option = removals[index];
    const next = removals[index + 1];
    const paired = option.startsWith("-") && next !== undefined && !next.startsWith("-");

    for (let position = values.length - 1; position >= 0; position--) {
      if (values[position] === option && (!paired || values[position + 1] === next)) {
        values.splice(position, paired ? 2 : 1);
      }
    }

    if (paired) {
      index++;
    }
  }
}
