import { useVirtualList, type UseVirtualListReturn } from "@vueuse/core";
import { type ComputedRef, nextTick, onBeforeUpdate, onUpdated, watch } from "vue";

export function useVersionViewport<T>(
  items: ComputedRef<Array<T>>, rowHeight: number,
): UseVirtualListReturn<T> & {
  "focusFirstVisible": () => void;
  "retry"            : (event: MouseEvent, refetch: () => Promise<unknown>) => Promise<void>;
} {
  const viewport = useVirtualList(items, { "itemHeight": rowHeight, "overscan": 2 });

  watch(items, () => {
    viewport.scrollTo(0, { "block": "start" });
  });

  const container = viewport.containerProps.ref;

  let previousFocus: Element | null = null;

  onBeforeUpdate(() => {
    const element = container.value;
    const focused = element?.ownerDocument.activeElement;

    previousFocus = focused && element?.contains(focused) ? focused : null;
  });
  onUpdated(() => {
    const element = container.value;

    if (element && previousFocus && !previousFocus.isConnected) {
      const { activeElement, body } = element.ownerDocument;

      if (activeElement === body || !activeElement?.isConnected) {
        element.focus({ "preventScroll": true });
      }
    }
    previousFocus = null;
  });

  function focusFirstVisible(): void {
    const element = container.value;

    if (element && element.ownerDocument.activeElement === element) {
      const firstVisible = Math.min(
        items.value.length - 1, Math.max(0, Math.floor(element.scrollTop / rowHeight)),
      );
      const firstRendered = viewport.list.value[0]?.index ?? 0;
      const buttons = element.querySelectorAll<HTMLButtonElement>("button");
      const target = buttons[Math.max(0, firstVisible - firstRendered)] ??
        element.querySelector<HTMLElement>("p[tabindex]");

      target?.focus({ "preventScroll": true });
    }
  }
  watch(viewport.list, focusFirstVisible, { "flush": "post" });

  async function retry(event: MouseEvent, refetch: () => Promise<unknown>): Promise<void> {
    const element = container.value;

    if (element?.ownerDocument.activeElement === event.currentTarget) {
      element?.focus();
    }
    await refetch();
    await nextTick();
    focusFirstVisible();
  }

  return { ...viewport, retry, focusFirstVisible };
}
