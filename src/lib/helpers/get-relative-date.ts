export function getRelativeDate({
  days = 0,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
  from = new Date,
}: {
  "days"?        : number;
  "hours"?       : number;
  "minutes"?     : number;
  "seconds"?     : number;
  "milliseconds"?: number;
  "from"?        : Date;
}): Date {
  const relativeDate = new Date(from);
  const result = {
    "days"   : days * 24 * 60 * 60 * 1000,
    "hours"  : hours * 60 * 60 * 1000,
    "minutes": minutes * 60 * 1000,
    "seconds": seconds * 1000,
  };

  relativeDate.setTime(
    relativeDate.getTime() +
    result.days +
    result.hours +
    result.minutes +
    result.seconds +
    milliseconds,
  );

  return relativeDate;
}
