import { log } from "@/lib/logging/scopes/log.ts";

export function runInUnrestricted(id: string, code: string): void {
  const startTime = performance.now();

  log.debug(`Initializing the '${id}' extension code`);

  /*
   * JavaScript also allows 'AsyncFunction' constructors.
   * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
   */
  const compiled = new Function(code);

  log.debug(`Executing the '${id}' extension code in the unrestricted environment`);
  compiled();

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(`The '${id}' plugin was successfully executed in ${timeDifference} ms`);
}