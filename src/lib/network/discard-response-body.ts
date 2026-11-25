export async function discardResponseBody(response: Response): Promise<void> {
  // The HTTP plugin releases its native response handle when the stream is consumed or cancelled.
  await response.body?.cancel().catch(() => {});
}
