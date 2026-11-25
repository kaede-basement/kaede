import { hasCssUrl, isButtonTypeAllowed, isInputTypeAllowed, isUrlSafe } from "ark-of-atrahasis";

import type { Methods } from "./ui-methods.ts";
import type { Primitive } from "./ui-protocol.ts";

type Convert = (value: unknown) => Primitive | undefined;
const numeric = new Set([
  "TabIndex", "MinLength", "MaxLength", "Rows", "Cols", "Width", "Height", "Colspan", "Rowspan",
]);
const flags = new Set([
  "Hidden",
  "Spellcheck",
  "Disabled",
  "Readonly",
  "Required",
  "Checked",
  "Autofocus",
  "Multiple",
  "Selected",
  "Controls",
  "Autoplay",
  "Loop",
  "Muted",
  "Open",
]);

export function setterConversion(kind: keyof typeof Methods, property: string): Convert {
  if (flags.has(property)) return Boolean;
  if (numeric.has(property)) return Number;
  if (["SafeProgressElement", "SafeMeterElement"].includes(kind) &&
    ["Value", "Min", "Max"].includes(property)) return Number;
  if (property === "Text") return value => String(value ?? "");
  if (property === "CSS") return value => {
    const css = String(value ?? "");

    return hasCssUrl(css) ? undefined : css;
  };
  if (["Href", "Src", "Poster"].includes(property)) {
    return value => (isUrlSafe(value) ? value : undefined);
  }
  if (property === "Type" && (kind === "SafeInputElement" || kind === "SafeButtonElement")) {
    const allowed = kind === "SafeInputElement" ? isInputTypeAllowed : isButtonTypeAllowed;

    return value => {
      const type = (value as string).toLowerCase();

      return typeof type === "string" && allowed(type) ? type : undefined;
    };
  }

  return String;
}
