export function hashString(input: string): number {
  let hash: number = 0;

  for (let index = 0; index < input.length; index++) {
    hash = Math.trunc(
      Math.imul(31, hash) +
      (input.codePointAt(index) ?? 0),
    );
  }

  return hash;
}
