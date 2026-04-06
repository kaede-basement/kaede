/*
 * Source - https://stackoverflow.com/a/65239086
 * Posted by amirhe, modified by community. See post 'Timeline' for change history
 * Retrieved 2026-04-06, License - CC BY-SA 4.0
 */
export function hashString(input: string): number {
  let hash: number = 0;

  for (let index = 0; index < input.length; index++) {
    hash = Math.imul(31, hash) + (input.codePointAt(index) ?? 0);
  }

  return Math.trunc(hash);
}
