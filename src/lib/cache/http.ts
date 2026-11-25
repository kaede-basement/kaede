import { fetch } from "@tauri-apps/plugin-http";

export class NetworkError extends Error {}

export async function requestDocument(url: string, headers?: Headers): Promise<{
  "response": Response;
  "bytes"?  : Uint8Array<ArrayBuffer>;
}> {
  let response: Response;

  try {
    response = await fetch(url, headers ? { headers } : undefined);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());

      return { response, bytes };
    }
  } catch (error) {
    throw new NetworkError(String(error), { "cause": error });
  }
  if (response.status === 304) return { response };
  await response.body?.cancel();
  throw new Error(`HTTP ${response.status} fetching ${url}`);
}

export function freshness(headers: Headers, fallback: number): {
  "lifetime"  : number;
  "freshUntil": number;
} | undefined {
  const now = Date.now();
  const date = Date.parse(headers.get("date") ?? "");
  const origin = Number.isFinite(date) ? date : now;
  const directives = (headers.get("cache-control") ?? "").toLowerCase()
    .split(",")
    .map(part => part.trim());

  if (directives.includes("no-store")) return;
  if (directives.some(part => (/^no-cache(?:\s*=|$)/).test(part))) {
    return { "lifetime": 0, "freshUntil": 0 };
  }
  const expires = Date.parse(headers.get("expires") ?? "");
  let lifetime = Number.isFinite(expires) ? Math.max(0, expires - origin) : fallback;

  for (const directive of directives) {
    const match = (/^max-age\s*=\s*(?:"(\d+)"|(\d+))$/).exec(directive);

    if (match) {
      lifetime = Math.min(Number.MAX_SAFE_INTEGER, Number(match[1] ?? match[2]) * 1000);
      break;
    }
  }
  const age = headers.get("age") ?? "";
  const ageMs = (/^\d+$/).test(age) ? Math.min(Number.MAX_SAFE_INTEGER, Number(age) * 1000) : 0;
  const currentAge = Math.max(0, now - origin, ageMs);

  const deadline = Math.min(Number.MAX_SAFE_INTEGER, now + (lifetime - currentAge));

  return { lifetime, "freshUntil": lifetime === 0 ? 0 : deadline };
}
