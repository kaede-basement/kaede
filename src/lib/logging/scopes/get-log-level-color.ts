export function getLogLevelColor(level: string): string {
  if (level.includes("DEBUG")) {
    return "text-white";
  }

  if (level.includes("INFO")) {
    return "text-blue-400";
  }

  if (level.includes("WARN")) {
    return "text-yellow-400";
  }

  if (level.includes("ERROR")) {
    return "text-red-600";
  }

  return "text-neutral-400";
}