import { invoke } from "@tauri-apps/api/core";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ref } from "vue";

import FileStructure from "@/constants/file-structure.ts";
import Browser from "@/lib/browser";
import FileManager from "@/lib/file-manager";

export const accountStoreError = ref(false);
export function setAccountStoreError(directory: string, error: boolean): void {
  if (directory === FileManager.getBaseDirectory()) {
    accountStoreError.value = error;
  }
}

export const AccountConflict = "accounts-conflict";
let bridgeStorage = false;

export function useBridgeAccountStorage(): void {
  bridgeStorage = true;
}

type AccountsFile =
  | { "status": "content" | "empty"; "raw": string }
  | { "status": "missing" | "invalidUtf8" };

export async function readAccountText(directory: string): Promise<string | undefined> {
  if (bridgeStorage || Browser.detectIsBrowser()) {
    const path = FileManager.join(directory, FileStructure.Files.Accounts);

    return await exists(path) ? readTextFile(path) : undefined;
  }
  const file = await invoke<AccountsFile>("read_accounts_file", { "baseDirectory": directory });

  switch (file.status) {
    case "content":
    case "empty": {
      return file.raw;
    }
    case "missing": {
      return;
    }
    default: {
      throw new Error("Cannot decode accounts.json as UTF-8");
    }
  }
}

export async function saveAccountText(
  directory: string, contents: string, createNew: boolean, expectedPrevious?: string,
): Promise<void> {
  if (bridgeStorage || Browser.detectIsBrowser()) {
    const path = FileManager.join(directory, FileStructure.Files.Accounts);

    if (createNew && await exists(path)) {
      throw AccountConflict;
    }
    await writeTextFile(path, contents, { createNew });
  } else if (await invoke<boolean>("save_accounts", {
    "baseDirectory": directory, contents, createNew, expectedPrevious,
  }) !== true) {
    throw new Error("Unacknowledged account write");
  }

  setAccountStoreError(directory, false);
}
