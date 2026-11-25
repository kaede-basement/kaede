import { GlobalInternals } from "@/extendable/global-internals.ts";
import Auth from "@/lib/auth";
import Launcher from "@/lib/launcher";
import type { LaunchAuthType } from "@/types/auth/microsoft-auth.type.ts";
import type { WrappedAccountsType } from "@/types/configs/account.type.ts";

export async function resolveLaunchPrerequisites(
  accounts: WrappedAccountsType, javaPath: string | undefined, signal: AbortSignal,
): Promise<[number, LaunchAuthType | undefined] | null> {
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
    const auth = Auth.resolveLaunchAccount(initial, signal).then(resolved => {
      if (resolved && resolved.accounts !== initial) {
        const { uuid } = resolved.auth;
        const refreshed = resolved.accounts.find(entry => entry.profile.uuid === uuid);

        if (refreshed) {
          accounts.value = accounts.value.map(entry => (
            entry.profile.uuid === refreshed.profile.uuid ? refreshed : entry
          ));
        }
      }

      return resolved?.auth;
    });

    return await Promise.race([stopped, Promise.all([java, auth])]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
