import { type ShallowRef, shallowRef, triggerRef } from "vue";

import type { LauncherStatusesType } from "@/types/launcher/launch/launch-status.type.ts";

type ProgressMap = LauncherStatusesType["downloads"]["current"];
const observedMaps = new WeakMap<ProgressMap, ShallowRef<ProgressMap>>;

export function trackDownloadProgress(current: ProgressMap): ProgressMap {
  let observed = observedMaps.get(current);

  if (!observed) {
    observed = shallowRef(current);
    observedMaps.set(current, observed);
  }

  return observed.value;
}

export function notifyDownloadProgress(current: ProgressMap): void {
  const observed = observedMaps.get(current);

  if (observed) {
    triggerRef(observed);
  }
}

export class ObservableDownloadMap extends Map<string, [number, number]> {
  override set(path: string, progress: [number, number]): this {
    super.set(path, progress);
    notifyDownloadProgress(this);

    return this;
  }

  override delete(path: string): boolean {
    const removed = super.delete(path);

    if (removed) {
      notifyDownloadProgress(this);
    }

    return removed;
  }

  override clear(): void {
    if (this.size > 0) {
      super.clear();
      notifyDownloadProgress(this);
    }
  }
}
