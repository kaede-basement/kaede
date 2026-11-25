import type { ResponseMetadata } from "@/lib/permissions/safe-response.ts";

import type { Lifecycle } from "../lifecycle-hooks.ts";
import type { CheckedValues, EventSnapshot, UIOp } from "./ui-protocol.ts";

export type Level = "debug" | "info" | "warn" | "error";
export type FetchResult = ResponseMetadata & { "handle": number | null };

export type ReleaseBody = { "kind": "release-body"; "id": number };
export type Request =
  | ReleaseBody
  | { "kind": "permissions"; "input": string[] }
  | { "kind": "read-log" }
  | { "kind": "read-body"; "handle": number }
  | {
    "kind": "fetch"; "permission": string; "transport": "webFetch" | "tauriFetch";
    "url": string; "body"?: string | ArrayBuffer; "contentType"?: string;
  };

export type Reply = string | Array<string | false> | FetchResult | ArrayBuffer | null;
export type ToWorker =
  | { "kind": "start"; "id": string; "code": string; "permissions": string[] }
  | { "kind": "lifecycle"; "method": Lifecycle }
  | {
    "kind": "event"; "node": number; "listener": number;
    "snapshot": EventSnapshot; "ackSeq": number; "checked"?: CheckedValues;
  }
  | { "kind": "checked"; "values": CheckedValues; "ackSeq": number }
  | { "kind": "reply"; "ticket": number; "value": Reply }
  | { "kind": "reject"; "ticket": number; "error": string };

export type FromWorker =
  | ReleaseBody
  | { "kind": "done" }
  | { "kind": "event-error"; "error": string }
  | { "kind": "failure"; "error": string }
  | { "kind": "request"; "ticket": number; "request": Request }
  | { "kind": "ui"; "ops": UIOp[]; "seq": number }
  | { "kind": "log"; "level": Level; "messages": string[] };
