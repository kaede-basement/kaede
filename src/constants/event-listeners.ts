import type { EventListenersType } from "@/types/extensions/event-listeners.type.ts";

export const AllEventListeners = {
  "all-clicks"  : true,
  "left-click"  : true,
  "middle-click": true,
  "right-click" : true,
  "routing"     : true,
  "instance"    : true,
} as const;
export const EventListeners: Record<string, Record<EventListenersType, unknown>> = {};
export const EventSubscribers: Set<string> = new Set;
