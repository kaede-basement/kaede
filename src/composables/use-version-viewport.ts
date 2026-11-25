import { useVirtualList, type UseVirtualListReturn } from "@vueuse/core";
import { type ComputedRef, nextTick, watch } from "vue";

export function useVersionViewport<T>(
  items: ComputedRef<Array<T>>, rowHeight: number,
): UseVirtualListReturn<T> & {
  "retry": (event: MouseEvent, refetch: () => Promise<unknown>) => Promise<void>;
} {
  const viewport = useVirtualList(items, { "itemHeight": rowHeight, "overscan": 2 });

  watch(items, () => {
    viewport.scrollTo(0, { "block": "start" });
  });

  const container = viewport.containerProps.ref;

  function focusFirstRow(): void {
    const element = container.value;

    if (element && element.ownerDocument.activeElement === element) {
      element.querySelector<HTMLElement>("button, p[tabindex]")?.focus();
    }
  }
  watch(viewport.list, focusFirstRow, { "flush": "post" });

  async function retry(event: MouseEvent, refetch: () => Promise<unknown>): Promise<void> {
    const element = container.value;

    if (element?.ownerDocument.activeElement === event.currentTarget) {
      element?.focus();
    }
    await refetch();
    await nextTick();
    focusFirstRow();
  }

  return { ...viewport, retry };
}
