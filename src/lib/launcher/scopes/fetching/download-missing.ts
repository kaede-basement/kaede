import FileManager from "@/lib/file-manager";
import { Algorithms } from "@/lib/hashing.ts";
import Network from "@/lib/network";
import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";

type DownloadOptions = Parameters<typeof Network.concurrentlyDownload>[0];

type Artifact = { "path": string; "url": string; "hash": string; "size"?: number };

export async function findMissingEntries<T extends Artifact>(
  entries: Array<T>, checksum?: boolean, signal?: AbortSignal,
): Promise<Array<T>> {
  if (signal?.aborted) {
    return [];
  }

  const paths = await FileManager.verifyPaths({
    "paths"    : entries,
    "algorithm": checksum ? Algorithms.SHA1 : undefined,
  });

  if (paths.length === 0 || signal?.aborted) {
    return [];
  }

  const missing = new Set(paths);

  return entries.filter(({ path }) => missing.has(path));
}

export function downloadEntries(
  options: Omit<DownloadOptions, "entries"> & { "entries": Array<Artifact> }, signal?: AbortSignal,
): Promise<DownloadReportType> {
  if (signal?.aborted || options.entries.length === 0) {
    return Promise.resolve({
      "success": 0, "failed": 0, "failures": [], "cancelled": !!signal?.aborted,
    });
  }

  return Network.concurrentlyDownload({
    ...options,
    "entries": options.entries.map(({ url, path, hash, size }) => ({
      url, path, size,
      ...(hash === "ignore" ? {} : { hash, "algorithm": Algorithms.SHA1 }),
    })),
  });
}

export async function downloadMissing({
  entries,
  checksum,
  signal,
  ...options
}: Omit<DownloadOptions, "entries"> & {
  "entries"  : Array<Artifact>;
  "checksum"?: boolean;
  "signal"?  : AbortSignal;
}): Promise<DownloadReportType> {
  const missing = await findMissingEntries(entries, checksum, signal);

  return downloadEntries({ ...options, "entries": missing }, signal);
}
