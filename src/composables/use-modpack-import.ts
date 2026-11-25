import { onScopeDispose, shallowRef } from "vue";

const active = shallowRef<AbortController>();

export function useModpackImport(): () => {
  "current": () => boolean;
  "signal" : AbortSignal;
  "finish" : () => void;
} {
  let owned: AbortController | undefined;

  function finish(request: AbortController): void {
    if (owned === request) owned = undefined;
    if (active.value === request) active.value = undefined;
  }

  onScopeDispose(() => {
    if (owned) {
      owned.abort();
      finish(owned);
    }
  });

  return () => {
    active.value?.abort();
    const request = new AbortController;

    owned = request;
    active.value = request;

    return {
      "current": () => active.value === request,
      "signal" : request.signal,
      "finish" : () => finish(request),
    };
  };
}
