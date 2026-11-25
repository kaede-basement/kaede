import { exists, mkdir, readDir, readFile } from "@tauri-apps/plugin-fs";

import Browser from "@/lib/browser";
import type { ParsedFile } from "@/types/application/parsed-file.type.ts";

import { join } from "./path.ts";
import { digestBytes, publishText, StateChanged } from "./publish-text.ts";

export async function readState<T>(
  directory: string, filename: string, preloaded: ParsedFile | undefined,
  empty: T, privateFile: boolean,
  validate: (input: unknown) => { "value": T; "valid": boolean },
): Promise<T> {
  if (preloaded?.status === "loaded") {
    const result = validate(preloaded.data);

    if (result.valid) return result.value;
  }
  const path = join(directory, filename);

  // Recovery always validates the exact byte snapshot it will compare and back up.
  for (;;) {
    let bytes: Uint8Array<ArrayBuffer> | undefined;

    try {
      bytes = await readFile(path);
      if (bytes.length === 0 && Browser.detectIsBrowser()) {
        // Preview returns zero bytes for both a missing key and an empty file.
        const entries = await readDir(directory);

        if (!entries.some(entry => entry.isFile && entry.name === filename)) {
          bytes = undefined;
        }
      }
    } catch (error) {
      if (await exists(path)) throw error;
    }
    let value = empty;

    if (bytes) {
      let parsed: unknown;

      try {
        parsed = JSON.parse(new TextDecoder("utf8", { "fatal": true }).decode(bytes));
      } catch (error) {
        if (!(error instanceof SyntaxError || error instanceof TypeError)) throw error;
      }
      if (parsed !== undefined) {
        const result = validate(parsed);

        if (result.valid) return result.value;
        value = result.value;
      }
    }
    try {
      if (!bytes) await mkdir(directory, { "recursive": true });
      const expected = bytes ? await digestBytes(bytes) : "missing";

      await publishText(path, JSON.stringify(value, null, 2), privateFile, !!bytes, expected);

      return value;
    } catch (error) {
      if ((error instanceof Error ? error.message : error) !== StateChanged) throw error;
    }
  }
}
