import { onScopeDispose } from "vue";

let generation = 0;

export function useModpackImport(): () => () => boolean {
  let mounted = true;

  onScopeDispose(() => {
    mounted = false;
  });

  return () => {
    const request = ++generation;

    return () => mounted && request === generation;
  };
}
