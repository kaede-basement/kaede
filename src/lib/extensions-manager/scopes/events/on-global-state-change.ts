import { handleEvent } from "@/lib/extensions-manager/scopes/handle-event.ts";
import type { GlobalStatesType } from "@/types/application/global-states.type.ts";

export function onGlobalStateChange<Key extends keyof GlobalStatesType>(
  key: Key,
  value: unknown,
): void {
  switch (key) {
    case "pages": {
      const pages = value as GlobalStatesType["pages"];

      handleEvent("routing", pages.current);

      break;
    }
  }
}