import { log } from "@/lib/logging/scopes/log.ts";

export function runInUnrestricted(id: string, code: string): void {
  const startTime = performance.now();

  log.debug(`Compiling the '${id}' extension code`);
  const compiled = new Function(code);

  log.debug(`Executing the '${id}' extension code in the unrestricted environment`);
  compiled();

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(`The '${id}' plugin was successfully executed in ${timeDifference} ms`);
}