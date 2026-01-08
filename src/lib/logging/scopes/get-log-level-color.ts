export function getLogLevelColor(level: string): string {
  switch (level) {
    case "DEBUG": {
      return "bg-black";
    }
    case "INFO": {
      return "bg-blue-600";
    }
    case "WARN": {
      return "bg-yellow-600";
    }
    case "ERROR": {
      return "bg-red-600";
    }
    default: {
      return "bg-neutral-700";
    }
  }
}
