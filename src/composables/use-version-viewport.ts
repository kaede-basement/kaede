import { useVirtualList, type UseVirtualListReturn } from "@vueuse/core";
import { type ComputedRef, watch } from "vue";

export function useVersionViewport<T>(
  items: ComputedRef<Array<T>>, rowHeight: number,
): UseVirtualListReturn<T> {
  const viewport = useVirtualList(items, { "itemHeight": rowHeight, "overscan": 2 });

  watch(items, () => {
    viewport.scrollTo(0, { "block": "start" });
  });

  return viewport;
}
