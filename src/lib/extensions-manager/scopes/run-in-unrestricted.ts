import { log } from "@/lib/logging/scopes/log.ts";

export function runInUnrestricted(id: string, code: string): void {
  const startTime = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${id}' extension code`);

  /*
   * JavaScript also allows 'AsyncFunction' constructors.
   * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
   */
  const compiled = new Function(code);

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Executing the '${id}' extension code in the unrestricted environment`,
  );
  compiled();

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${id}' plugin was successfully executed in ${timeDifference} ms`,
  );
}
