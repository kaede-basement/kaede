import { onScopeDispose, ref } from "vue";

const generation = ref(0);

export function useModpackImport(): () => () => boolean {
  let mounted = true;

  onScopeDispose(() => {
    mounted = false;
  });

  return () => {
    const request = ++generation.value;

    return () => mounted && request === generation.value;
  };
}
