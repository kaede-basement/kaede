import { join } from "@tauri-apps/api/path";
import {
  copyFile,
  create,
  type DirEntry,
  mkdir,
  readDir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";

import { ApplicationName } from "@/constants/application.ts";
import General from "@/lib/general";

function getNumberFromLogFilename(filename: string): number {
  // 'kaede-0.log' -> 'kaede-0'
  const currentLogName: string | undefined = filename.split(".")?.[0];
  // 'kaede-0' -> '0';
  const currentLogNumber: number = Number(currentLogName?.split?.("-")?.[1]);

  // User might have created some nonsense files in the 'logs' directory
  if (Number.isNaN(currentLogNumber)) {
    return 0;
  }

  return currentLogNumber;
}

/**
 * Strategy:
 *
 * if 'latest.log' exists, and it is not empty,
 * then we copy everything from it to the 'kaede-{number}.log' file
 * and clear the 'latest.log' file since we want to separate previous launcher logs from current
 *
 * else just write into 'latest.log' without other manipulations
 */
export async function prepareLogFile(portable: boolean): Promise<void> {
  const baseDirectory = await General.getBaseDirectory(portable);
  const logsDirectory = await join(baseDirectory, "logs");

  // We are assuming that 'latest.log' doesn't exist
  let latestLogExists = false;
  // And we will keep track of the biggest log file number to make a unique name
  let biggestLogNumber = 0;

  // User can delete 'logs' folder while running launcher, and then refresh the launcher
  let entries: DirEntry[];

  try {
    entries = await readDir(logsDirectory);
  } catch {
    entries = [];

    // Error means that 'logs' directory doesn't exist
    await mkdir(logsDirectory);
  }

  for (const entry of entries) {
    // 'latest.log' exists
    if (entry.name === "latest.log") {
      latestLogExists = true;

      continue;
    }

    biggestLogNumber = Math.max(biggestLogNumber, getNumberFromLogFilename(entry.name));
  }

  const latestLogPath = await join(logsDirectory, "latest.log");

  if (!latestLogExists) {
    // 'latest.log' doesn't exist, so we manually create it
    const newLatestLogFile = await create(latestLogPath);

    await newLatestLogFile.close();

    return;
  }

  const latestLogContent = await readTextFile(latestLogPath);

  // 'latest.log' is empty; no need to copy empty contents into another log file
  if (latestLogContent === "") {
    return;
  }

  const renamedLogPath = await join(
    logsDirectory,
    `${ApplicationName.toLowerCase()}-${biggestLogNumber + 1}.log`,
  );

  // Copy existing contents from 'latest.log' to 'kaede-{number}.log'
  await copyFile(latestLogPath, renamedLogPath);
  // Clear the 'latest.log' file
  await writeTextFile(latestLogPath, "");
}