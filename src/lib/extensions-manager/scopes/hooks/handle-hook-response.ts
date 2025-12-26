import { ApplicationNamespace } from "@/constants/application.ts";
import { HookResponseStatus } from "@/constants/hooks.ts";
import { log } from "@/lib/logging/scopes/log.ts";
import type { ExtensionStatusType } from "@/types/extensions/hook-return.type.ts";

export function handleHookResponse<T>({
  scope,
  status,
  response,
  timing,
  index,
  times,
}: {
  "scope"   : keyof (Window[typeof ApplicationNamespace]["hooks"]);
  "status"  : ExtensionStatusType;
  "response": T | undefined;
  "timing"  : "before" | "after";
  "index"   : number;
  "times"   : {
    "overallStart": number;
    "hookStart"   : number;
  };
}): "continue-hooks-loop" | T | undefined {
  const timeMeasurementEndHook = performance.now();
  const currentHookTime = timeMeasurementEndHook - times.hookStart;

  log.debug(log.templates.hooks.iterate.response(
    scope,
    { status, response },
    timing,
    index,
    currentHookTime,
  ));

  if (status !== HookResponseStatus.Stop) {
    return "continue-hooks-loop";
  }

  const timeMeasurementEnd = performance.now();
  const hooksTime = timeMeasurementEnd - times.overallStart;

  log.debug(log.templates.hooks.iterate.end(
    scope,
    timing,
    hooksTime,
  ));

  return response;
}
