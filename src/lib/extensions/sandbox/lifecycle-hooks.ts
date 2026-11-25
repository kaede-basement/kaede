const methods = ["enable", "disable", "afterDisable"] as const;

export type Lifecycle = typeof methods[number];
type Hook = () => void | Promise<void>;
export type SandboxHooks = Record<Lifecycle, Hook>;

export function lifecycleHooks(result: unknown): SandboxHooks {
  const hooks: SandboxHooks = { enable() {}, disable() {}, afterDisable() {} };

  if (typeof result === "object" && result !== null) {
    for (const name of methods) {
      const hook = (result as Partial<SandboxHooks>)[name];

      if (typeof hook === "function") hooks[name] = (): ReturnType<Hook> => (
        Reflect.apply(hook, result, [])
      );
    }
  }

  return hooks;
}
