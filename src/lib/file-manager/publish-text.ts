import { invoke } from "@tauri-apps/api/core";
import * as fs from "@tauri-apps/plugin-fs";

import Browser from "@/lib/browser";

import { hasNativeStorage } from "./storage-backend.ts";

export async function publishText(
  path: string, contents: string, privateFile = false, preserve = false, expectedJson?: string,
): Promise<void> {
  if (hasNativeStorage()) {
    return invoke("publish_text", {
      path, contents, "private": privateFile, preserve, expectedJson,
    });
  }
  if (!Browser.detectIsBrowser()) {
    throw new Error("The Wails backend requires atomic state publication support");
  }
  if (preserve) {
    const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const directory = path.slice(0, slash + 1);
    const prefix = path.slice(slash + 1) + ".corrupt-";
    const suffix = crypto.getRandomValues(new Uint32Array(2)).join("-");
    const backup = prefix + Date.now() + "-" + suffix + ".bak";

    await fs.writeFile(directory + backup, await fs.readFile(path), { "createNew": true });
    const entries = await fs.readDir(directory);
    const archives = entries.filter(entry => entry.isFile
      && entry.name.startsWith(prefix) && entry.name !== backup
      && (/^\d+-\d+-\d+\.bak$/).test(entry.name.slice(prefix.length)))
      .map(entry => entry.name)
      .sort();

    for (const old of archives.slice(0, -2)) await fs.remove(directory + old);
  }
  await fs.writeTextFile(path, contents);
}
