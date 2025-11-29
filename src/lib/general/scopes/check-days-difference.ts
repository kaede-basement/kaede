const day: number = 1000 * 60 * 60 * 24;

export function checkDaysDifference(from: Date, to: Date): number {
  const absoluteFrom = from.valueOf();
  const absoluteTo = to.valueOf();

  return Math.floor(
    Math.abs(absoluteFrom - absoluteTo) / day,
  );
}