import { type ChildProcess, Command } from "tauri-plugin-shellx-api";

import Errors from "@/lib/errors";
import { log } from "@/lib/logging/scopes/log.ts";

const FamousAndOldJavaMajorVersion: number = 8;

export async function getJavaMajor(): Promise<number> {
  let process: ChildProcess<string>;

  try {
    log.debug("Getting the Java version");
    process = await Command.create("java", [
      // The '--version' arguments does not work in Java 8 and older
      "-version",
    ]).execute();
  } catch (error: unknown) {
    log.error("Could not get the Java version output:", Errors.prettify(error));

    return FamousAndOldJavaMajorVersion;
  }

  /*
   * The output format is similar to this:
   * openjdk version "25.0.1" 2025-10-21 LTS
   *
   * Also, seems like the output is written into 'stderr' instead of 'stdout'
   * while the 'stdout' part remains an empty string
   */
  const output: string = (process.stdout || process.stderr) ?? "";
  const parsed: Array<string> = output.split("\"");
  const possibleVersion: string | undefined = parsed?.[1];

  if (!possibleVersion) {
    log.error("Could not parse the Java major version. The original output:", output);

    return FamousAndOldJavaMajorVersion;
  }

  const majorVersion: number = Number(
    possibleVersion.split(".")?.[0],
  );

  if (Number.isNaN(majorVersion)) {
    log.error("The parsed Java major version is not a number. The original output:", output);

    return FamousAndOldJavaMajorVersion;
  }

  log.debug("The current Java major version is:", majorVersion.toString());

  return majorVersion;
}
