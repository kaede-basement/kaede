import { log } from "@/lib/logging/scopes/log.ts";

/*
 * JavaScript allows 'AsyncFunction' constructors.
 * see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
 */
const AsyncFunction = async function (): Promise<void> {}.constructor as FunctionConstructor;

export async function runInUnrestricted(id: string, code: string): Promise<void> {
  const startTime = performance.now();

  log.debug(__PRE_BUNDLED_FILENAME__, `Initializing the '${id}' extension code`);

  const compiled = new AsyncFunction(code);

  log.debug(
    __PRE_BUNDLED_FILENAME__,
    `Executing the '${id}' extension code in the unrestricted environment`,
  );
  await compiled();

  const endTime = performance.now();
  const timeDifference = (endTime - startTime).toFixed(2);

  log.info(
    __PRE_BUNDLED_FILENAME__,
    `The '${id}' plugin was successfully executed in ${timeDifference} ms`,
  );
}
