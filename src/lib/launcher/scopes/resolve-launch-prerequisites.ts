import { GlobalInternals } from "@/extendable/global-internals.ts";
import Auth from "@/lib/auth";
import Launcher from "@/lib/launcher";
import type { AccountType } from "@/types/configs/account.type.ts";

export async function resolveLaunchPrerequisites(
  accounts: Array<AccountType>, javaPath: string | undefined, signal: AbortSignal,
): Promise<[number, Awaited<ReturnType<typeof Auth.resolveLaunchAccount>>] | null> {
  if (signal.aborted) return null;
  let abort!: () => void;
  const stopped = new Promise<null>(resolve => {
    abort = (): void => resolve(null);
  });

  signal.addEventListener("abort", abort, { "once": true });
  try {
    const java = javaPath || !GlobalInternals.javaMajor
      ? Launcher.fetchJavaMajor(javaPath)
      : GlobalInternals.javaMajor;

    const prerequisites = Promise.all([java, Auth.resolveLaunchAccount(accounts, signal)]);

    return await Promise.race([stopped, prerequisites]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
