import "ses";

export function lockdownEnvironment(): void {
  /*
   * Can throw an error, which is a desirable behaviour
   * since we do NOT want to execute sandboxed plugins without environment lockdown
   */
  lockdown({
    "evalTaming": "safeEval",
  });
}