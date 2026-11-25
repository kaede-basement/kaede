import type { DeclarativeListenerOptions, SafeDocument, SafeEvent } from "ark-of-atrahasis";

export type Factory = Exclude<keyof SafeDocument, "getElement">;
export type Primitive = string | boolean | number;
export type EventOptions = DeclarativeListenerOptions;
export type UIOp =
  | ["root", number, string]
  | ["create", number, Factory, Primitive[]]
  | ["set", number, string, Primitive[]]
  | ["event-value", number, string]
  | ["style", number, string, string]
  | ["appendChild" | "removeChild", number, number]
  | ["insertBefore" | "replaceChild", number, number, number]
  | ["remove" | "release", number]
  | ["listen", number, string, number, EventOptions]
  | ["unlisten", number, number];

export type CheckedValues = Array<[number, boolean]>;
export type TargetSnapshot = SafeEvent["target"] & { "node"?: number };
export type EventSnapshot = Omit<SafeEvent,
  "preventDefault" | "stopPropagation" | "stopImmediatePropagation" | "target" | "currentTarget"
> & { "target": TargetSnapshot; "currentTarget": TargetSnapshot };
