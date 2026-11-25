import { extract } from "@/lib/errors/scopes/extract.ts";
import { handleCapture } from "@/lib/errors/scopes/handle-capture.ts";
import { prettify } from "@/lib/errors/scopes/prettify.ts";
import { showError } from "@/lib/errors/scopes/show-error.ts";
import { stringify } from "@/lib/errors/scopes/stringify.ts";

export default {
  extract,
  handleCapture,
  prettify,
  stringify,
  showError,
} as const;