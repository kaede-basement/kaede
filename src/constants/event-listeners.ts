import type { EventListenersType } from "@/types/extensions/event-listeners.type.ts";

export const AllEventListeners = {
  "all-clicks"  : true,
  "left-click"  : true,
  "scroll-click": true,
  "right-click" : true,
} as const;
export const EventListeners: Record<string, EventListenersType> = {};