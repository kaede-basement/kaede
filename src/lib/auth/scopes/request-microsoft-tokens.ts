/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { MicrosoftAuth } from "@/constants/launcher.ts";
import { log } from "@/lib/logging/log.ts";
import { fetchDocument as fetch } from "@/lib/network/fetch-document.ts";
import type { MicrosoftTokensType } from "@/types/auth/microsoft-auth.type.ts";

/**
 * First sign-in     - an authorization code
 * Non-first sign-in - a refresh token
 */
export async function requestMicrosoftTokens(grant: {
  "kind"        : "authorization-code";
  "code"        : string;
  "redirectUri" : string;
  "codeVerifier": string;
} | {
  "kind"        : "refresh-token";
  "refreshToken": string;
}): Promise<MicrosoftTokensType> {
  const body: URLSearchParams = new URLSearchParams({
    "client_id": MicrosoftAuth.ClientId,
    "scope"    : MicrosoftAuth.Scope,
  });

  if (grant.kind === "authorization-code") {
    body.set("grant_type", "authorization_code");
    body.set("code", grant.code);
    body.set("redirect_uri", grant.redirectUri);
    body.set("code_verifier", grant.codeVerifier);
  } else {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", grant.refreshToken);
  }

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Requesting Microsoft tokens ('${grant.kind}' grant)`,
  );
  const response: Response = await fetch(MicrosoftAuth.Endpoints.Token, {
    "method" : "POST",
    "headers": {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    "body": body.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => {});
    const code = typeof error?.error_description === "string"
      ? (/^AADSTS[0-9]+/).exec(error.error_description)?.[0] : undefined;

    throw new Error(
      `Microsoft token request failed with HTTP ${response.status}${code ? ` (${code})` : ""}`,
    );
  }

  const parsed: {
    "access_token" ?: string;
    "refresh_token"?: string;
    "expires_in"   ?: number;
  } = await response.json();

  if (typeof parsed?.access_token !== "string" || parsed.access_token.length === 0) {
    throw new Error("The Microsoft token response is missing the access token");
  }

  if (typeof parsed?.refresh_token !== "string" || parsed.refresh_token.length === 0) {
    throw new Error(
      "The Microsoft token response is missing the refresh token. " +
      "Is the 'offline_access' scope present?",
    );
  }

  return {
    "accessToken" : parsed.access_token,
    "refreshToken": parsed.refresh_token,
    "expiresIn"   : typeof parsed.expires_in === "number"
      ? parsed.expires_in
      : 3600,
  };
}
