import { BaseDirectory, create, copyFile, readDir, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { ApplicationName } from "@/constants/application.ts";

function getNumberFromLogFilename(filename: string): number {
  const currentLogName: string | undefined = filename.split(".")?.[0];
  const currentLogNumber = Number(currentLogName?.split?.("-")?.[1]);

  // User might have created some nonsense files in the 'logs' directory
  if (Number.isNaN(currentLogNumber)) {
    return 0;
  }

  return currentLogNumber;
}

/**
 * Strategy:
 *
 * if 'latest.log' exists, then we copy everything from it to the 'kaede-{number}.log' file
 * and clear the 'latest.log' file since we want to separate previous launcher logs from current
 *
 * else just write into 'latest.log' without other manipulations
 */
export async function prepareLogFile(): Promise<void> {
  // We are assuming that 'latest.log' doesn't exist
  let latestLogExists = false;
  // And we will keep track of the biggest log file number to make a unique name
  let biggestLogNumber = 0;

  const entries = await readDir("logs", {
    "baseDir": BaseDirectory.AppData,
  });

  for (const entry of entries) {
    // 'latest.log' exists
    if (entry.name === "latest.log") {
      latestLogExists = true;

      continue;
    }

    biggestLogNumber = Math.max(biggestLogNumber, getNumberFromLogFilename(entry.name));
  }

  const latestLogPath = await join("logs", "latest.log");

  if (!latestLogExists) {
    // 'latest.log' doesn't exist, so we manually create it
    const newLatestLogFile = await create(latestLogPath, {
      "baseDir": BaseDirectory.AppData,
    });

    await newLatestLogFile.close();

    return;
  }

  const renamedLogPath = await join("logs", `${ApplicationName.toLowerCase()}-${biggestLogNumber + 1}.log`);

  // Copy existing contents from 'latest.log' to 'kaede-{number}.log'
  await copyFile(latestLogPath, renamedLogPath, {
    "fromPathBaseDir": BaseDirectory.AppData,
    "toPathBaseDir"  : BaseDirectory.AppData,
  });
  // Clear the 'latest.log' file
  await writeTextFile(latestLogPath, "", {
    "baseDir": BaseDirectory.AppData,
  });

  return;
}