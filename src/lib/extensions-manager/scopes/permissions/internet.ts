import { type ClientOptions, fetch as tauriFetch } from "@tauri-apps/plugin-http";

import { GrantedScopes } from "@/constants/permissions.ts";
import { log } from "@/lib/logging/scopes/log.ts";

export function handleInternetPermission(id: string): void {
  const wrappedWebFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `The '${id}' plugin made a Web fetch call with the next params:`,
      "\n" + JSON.stringify({ input, init }, null, 2),
    );

    return fetch(input, init);
  };
  const wrappedTauriFetch = async (
    input: URL | Request | string,
    init?: RequestInit & ClientOptions,
  ): Promise<Response> => {
    log.debug(
      __PRE_BUNDLED_FILENAME__,
      `The '${id}' plugin made a Tauri fetch call with the next params:`,
      "\n" + JSON.stringify({ input, init }, null, 2),
    );

    return tauriFetch(input, init);
  };

  GrantedScopes[id].webFetch = wrappedWebFetch;
  GrantedScopes[id].tauriFetch = wrappedTauriFetch;
}
