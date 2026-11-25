import { verifyPaths } from "@/lib/file-manager/path.ts";
import { Algorithms } from "@/lib/hashing.ts";
import Network from "@/lib/network";
import type { DownloadReportType } from "@/types/launcher/artifacts/download.type.ts";

type DownloadOptions = Parameters<typeof Network.concurrentlyDownload>[0];

export async function downloadMissing({
  entries,
  checksum,
  ...options
}: Omit<DownloadOptions, "entries"> & {
  "entries"  : Array<{ "path": string; "url": string; "hash": string }>;
  "checksum"?: boolean;
}): Promise<DownloadReportType> {
  const missing = new Set(await verifyPaths({
    "paths"    : checksum ? entries.map(({ path, hash }) => ({ path, hash })) : entries,
    "algorithm": checksum ? Algorithms.SHA1 : undefined,
  }));

  if (missing.size === 0) {
    return { "success": 0, "failed": 0, "failures": [], "cancelled": false };
  }

  return Network.concurrentlyDownload({
    ...options,
    "entries": entries.filter(({ path }) => missing.has(path)),
  });
}
