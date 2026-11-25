type ParsedPermission =
  | { "base": "time"; "scope": "date" | "performance"; "raw": string }
  | { "base": "ui"; "scope": "basic" | "interactivity"; "raw": string }
  | { "base": "log"; "scope": "read" | "write"; "raw": string }
  | { "base": "internet"; "scope": "http-get" | "http-post"; "url": URL; "raw": string };

export function parsePermission(raw: unknown): ParsedPermission | undefined {
  if (typeof raw !== "string") {
    return;
  }
  const separator = raw.indexOf("::");
  const base = raw.slice(0, separator);
  const tail = raw.slice(separator + 2);

  switch (base) {
    case "time": {
      if (tail === "date" || tail === "performance") {
        return { base, "scope": tail, raw };
      }
      break;
    }
    case "ui": {
      if (tail === "basic" || tail === "interactivity") {
        return { base, "scope": tail, raw };
      }
      break;
    }
    case "log": {
      if (tail === "read" || tail === "write") {
        return { base, "scope": tail, raw };
      }
      break;
    }
    case "internet": {
      const boundary = tail.indexOf("::");
      const scope = tail.slice(0, boundary);

      if (boundary === -1 || (scope !== "http-get" && scope !== "http-post")) {
        return;
      }
      try {
        const url = new URL(tail.slice(boundary + 2));

        const scopedPath = !url.href.includes("?") && !url.href.includes("#");

        if (scopedPath && (url.protocol === "https:" || url.protocol === "http:")) {
          return { base, scope, url, raw };
        }
      } catch {
        return;
      }
    }
  }
}
