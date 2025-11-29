import "ses";

export function lockdownEnvironment(): void {
  /*
   * Can throw an error, which is a desirable behaviour
   * since we do NOT want to execute sandboxed plugins without environment lockdown
   */
  lockdown({

    /*
     * 'safeEval' adds some restrictions to 'eval' and the 'Function' constructor, e.g.:
     * - anything that looks like HTML comments is rejected.
     *
     * 'noEval' completely disables 'eval' and the 'Function' constructor.
     *
     * 'unsafeEval' appears not to change the behaviour of 'eval' and the 'Function' constructor.
     */
    "evalTaming": "unsafeEval",
  });
}