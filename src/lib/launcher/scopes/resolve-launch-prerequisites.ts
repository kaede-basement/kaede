import { GlobalInternals } from "@/extendable/global-internals.ts";
import {
  type AccountResolution, resolveLaunchAccountOutcome,
} from "@/lib/auth/scopes/resolve-launch-account.ts";
import Launcher from "@/lib/launcher";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

export async function resolveLaunchPrerequisites(
  accounts: WrappedAccountsType, javaPath: string | undefined, signal: AbortSignal,
): Promise<[number, AccountResolution] | null> {
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

    const initial = accounts.value;
    const auth = resolveLaunchAccountOutcome(initial, signal).then(result => {
      if (result.status === "ready" && result.accounts !== initial) {
        accounts.value = accounts.value.map(entry => (
          entry.profile.uuid === result.account.profile.uuid ? result.account : entry
        ));
      }

      return result;
    });

    return await Promise.race([stopped, Promise.all([java, auth])]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
