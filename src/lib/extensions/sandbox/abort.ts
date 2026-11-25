export function activationAbortReason(signal?: AbortSignal): unknown {
  return signal?.reason ?? new Error("Sandbox activation ended");
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw activationAbortReason(signal);
}
