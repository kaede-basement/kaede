import { extract } from "@/lib/errors/scopes/extract.ts";
import { handleCapture } from "@/lib/errors/scopes/handle-capture.ts";
import { ErrorFormatting } from "@/lib/errors/scopes/prettify.ts";
import { stringify } from "@/lib/errors/scopes/stringify.ts";

export default Object.assign(ErrorFormatting, {
  extract,
  handleCapture,
  stringify,
} as const);