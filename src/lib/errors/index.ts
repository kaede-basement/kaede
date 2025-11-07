import { extract } from "@/lib/errors/scopes/extract.ts";
import { handleCapture } from "@/lib/errors/scopes/handle-capture.ts";
import { stringify } from "@/lib/errors/scopes/stringify.ts";

export default {
  extract,
  stringify,
  handleCapture,
} as const;