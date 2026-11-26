import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";

import Browser from "@/lib/browser";

import { hasNativeStorage } from "./storage-backend.ts";

export const StateChanged = "State changed before recovery";

export async function digestBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function publishText(
  path: string, contents: string, privateFile = false, preserve = false, expectedHash?: string,
): Promise<void> {
  if (hasNativeStorage()) {
    return invoke("publish_text", {
      path, contents, "private": privateFile, preserve, expectedHash,
    });
  }
  if (!Browser.detectIsBrowser()) {
    throw new Error("The Wails backend requires atomic state publication support");
  }
  const publish = async (): Promise<void> => {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const directory = path.slice(0, slash + 1);
    const file = path.slice(slash + 1);
    const entries = expectedHash ? await fs.readDir(directory) : [];
    const present = entries.some(entry => entry.isFile && entry.name === file);

    if (expectedHash === "missing" && present) throw new Error(StateChanged);
    if (preserve) {
      if (!present) throw new Error(StateChanged);
      const bytes = await fs.readFile(path);

      if (await digestBytes(bytes) !== expectedHash) throw new Error(StateChanged);
      const prefix = file + ".corrupt-";
      const archives = entries.filter(entry => entry.isFile && entry.name.startsWith(prefix)
        && (/^\d+-\d+-\d+\.bak$/).test(entry.name.slice(prefix.length)))
        .map(entry => entry.name)
        .sort();
      let duplicate: string | undefined;

      for (const name of archives) {
        if (await digestBytes(await fs.readFile(directory + name)) === expectedHash) {
          duplicate = name;
          break;
        }
      }
      const excess = archives.length - (duplicate ? 3 : 2);

      for (const old of archives.filter(name => name !== duplicate).slice(0, Math.max(0, excess))) {
        await fs.remove(directory + old);
      }
      if (!duplicate) {
        const suffix = crypto.getRandomValues(new Uint32Array(2)).join("-");
        const backup = prefix + Date.now() + "-" + suffix + ".bak";

        await fs.writeFile(directory + backup, bytes, { "createNew": true });
      }
    }
    await fs.writeTextFile(path, contents);
  };
  const locks = globalThis.navigator?.locks;

  return locks ? locks.request("kaede-state:" + path, publish) : publish();
}
