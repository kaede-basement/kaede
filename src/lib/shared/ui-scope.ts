import type { SafeDocument } from "ark-of-atrahasis";

export const InteractiveFactories = [
  "createStyle",
  "createAnchor",
  "createCanvas",
  "createImage",
  "createVideo",
  "createAudio",
  "createSource",
] as const satisfies ReadonlyArray<keyof SafeDocument>;

export function restrictUI(gui: SafeDocument, interactive: boolean): unknown {
  const granted: Partial<Record<keyof SafeDocument, unknown>> = { ...gui };

  if (!interactive) {
    for (const name of InteractiveFactories) {
      granted[name] = undefined;
    }
  }

  return harden(granted);
}
