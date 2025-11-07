import { extract } from "@/lib/errors/scopes/extract.ts";
import { stringify } from "@/lib/errors/scopes/stringify.ts";
import { handleCapture } from "@/lib/errors/scopes/handle-capture.ts";

export default {
  extract,
  stringify,
  handleCapture,
} as const;