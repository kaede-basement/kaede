import { fetch } from "@tauri-apps/plugin-http";

import type { Entry } from "./storage.ts";

export class NetworkError extends Error {}

type Reply = {
  "requestTime" : number;
  "responseTime": number;
  "response"    : Response;
  "bytes"?      : Uint8Array<ArrayBuffer>;
};

export async function requestDocument(url: string, headers?: Headers): Promise<Reply> {
  const requestTime = Date.now();
  let response: Response;

  try {
    response = await fetch(url, headers ? { headers } : undefined);
    const responseTime = Date.now();

    if (response.status === 304) return { response, requestTime, responseTime };
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());

      return { response, bytes, requestTime, responseTime };
    }
  } catch (error) {
    throw new NetworkError(String(error), { "cause": error });
  }
  await response.body?.cancel();
  throw new Error(`HTTP ${response.status} fetching ${url}`);
}

export function freshness(
  { response, requestTime, responseTime }: Reply, fallback: number, previous?: Entry,
): Pick<Entry, "cacheControl" | "expires" | "freshUntil" | "fallbackTtl"> | undefined {
  const headers = response.headers;
  const date = Date.parse(headers.get("date") ?? "");
  const origin = Number.isFinite(date) ? date : responseTime;
  const cacheControl = headers.get("cache-control") ?? previous?.cacheControl;
  const expires = headers.get("expires") ?? previous?.expires;
  const fallbackTtl = previous?.fallbackTtl ?? fallback;
  const policy = { cacheControl, expires, fallbackTtl };
  const directives = (cacheControl ?? "").toLowerCase()
    .split(",")
    .map(part => part.trim());

  if (directives.includes("no-store")) return;
  if (directives.some(part => (/^no-cache(?:\s*=|$)/).test(part))) {
    return { ...policy, "freshUntil": 0 };
  }
  let lifetime = fallbackTtl;

  if (expires !== undefined) {
    const expiry = Date.parse(expires);

    lifetime = Number.isFinite(expiry) ? Math.max(0, expiry - origin) : 0;
  }

  for (const directive of directives) {
    const match = (/^max-age\s*=\s*(?:"(\d+)"|(\d+))$/).exec(directive);

    if (match) {
      lifetime = Math.min(Number.MAX_SAFE_INTEGER, Number(match[1] ?? match[2]) * 1000);
      break;
    }
  }
  const age = headers.get("age") ?? "";
  const ageMs = (/^\d+$/).test(age) ? Math.min(Number.MAX_SAFE_INTEGER, Number(age) * 1000) : 0;
  const delay = Math.max(0, responseTime - requestTime);
  const initialAge = Math.max(0, responseTime - origin, ageMs + delay);

  const deadline = Math.min(Number.MAX_SAFE_INTEGER, responseTime + (lifetime - initialAge));

  return { ...policy, "freshUntil": lifetime === 0 ? 0 : deadline };
}
